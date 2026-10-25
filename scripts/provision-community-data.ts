import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { CommunityMap } from '../src/lib/server/community-map';
import { communityPsql, hashEvidence } from '../src/lib/server/community-evidence';
import { ZetarisClient } from '../src/lib/server/zetaris';

const tables = ['batches', 'reports', 'report_places', 'sites', 'logistics_scope'];
const plan = { namespace: 'community_v1', container: 'portal-one-relief-db', source: 'PORTALONE_COMMUNITY_V1',
  tables, operation: 'Add immutable report metadata/grounding tables and limited roles; preserve synthetic v1 and all platform data.' };
if (!process.argv.includes('--apply')) { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }
const inspect = Bun.spawnSync(['docker', 'inspect', 'portal-one-relief-db'], { stdout: 'pipe', stderr: 'pipe' });
if (inspect.exitCode) throw new Error('Owned relief database is unavailable.');
const owned = JSON.parse(inspect.stdout.toString())[0];
if (owned.Config.Labels?.['portal-one.managed'] !== 'relief-scenario-v1' || !owned.State.Running ||
    owned.Config.Image !== 'postgres@sha256:f4610795587492cd4fb887c2dc3de301b813278bb6f616992061141b5f15ac36') throw new Error('Unexpected source container identity.');
mkdirSync('.runtime/community-v1', { recursive: true });
const file = '.runtime/community-v1/credentials.json';
const secret = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { reader: randomBytes(32).toString('hex') };
if (!/^[a-f0-9]{64}$/.test(secret.reader)) throw new Error('Unexpected source reader credential.');
if (!existsSync(file)) writeFileSync(file, JSON.stringify(secret) + '\n', { mode: 0o600 });
const map = new CommunityMap();
const sites = Buffer.from(JSON.stringify(map.places.map(p => ({ place_id: p.id, name: p.name, map_revision: hashEvidence(map.manifest) })))).toString('base64');
await communityPsql(`BEGIN;
  CREATE SCHEMA IF NOT EXISTS community_v1;
  CREATE TABLE IF NOT EXISTS community_v1.batches(id text PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'), source_id text NOT NULL,
    map_revision text NOT NULL, report_count integer NOT NULL CHECK(report_count BETWEEN 0 AND 1000), created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE IF NOT EXISTS community_v1.reports(batch_id text NOT NULL REFERENCES community_v1.batches(id),signal_id text NOT NULL,
    mode text NOT NULL CHECK(mode IN ('demo','live')),category text NOT NULL,relation text NOT NULL CHECK(relation IN ('direct','forwarded','reported')),
    observed_at text NOT NULL,ground_status text NOT NULL CHECK(ground_status IN ('named_place','ambiguous','reported_gps','unresolved')),
    candidate_count integer NOT NULL CHECK(candidate_count BETWEEN 0 AND 16),origin_verified boolean NOT NULL CHECK(origin_verified=false),PRIMARY KEY(batch_id,signal_id));
  CREATE TABLE IF NOT EXISTS community_v1.sites(place_id text PRIMARY KEY,name text NOT NULL,map_revision text NOT NULL);
  CREATE TABLE IF NOT EXISTS community_v1.report_places(batch_id text NOT NULL,signal_id text NOT NULL,place_id text NOT NULL REFERENCES community_v1.sites(place_id),
    PRIMARY KEY(batch_id,signal_id,place_id),FOREIGN KEY(batch_id,signal_id) REFERENCES community_v1.reports(batch_id,signal_id));
  CREATE TABLE IF NOT EXISTS community_v1.logistics_scope(place_id text PRIMARY KEY REFERENCES community_v1.sites(place_id),depot_id text NOT NULL,simulated boolean NOT NULL CHECK(simulated=true));
  INSERT INTO community_v1.sites SELECT * FROM jsonb_to_recordset(convert_from(decode('${sites}','base64'),'UTF8')::jsonb)
    AS s(place_id text,name text,map_revision text) ON CONFLICT DO NOTHING;
  INSERT INTO community_v1.logistics_scope VALUES('places-node:1744470346','sim-bamenda-hub',true) ON CONFLICT DO NOTHING;
  DO $$ BEGIN
    IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='community_writer') THEN CREATE ROLE community_writer LOGIN; END IF;
    IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='community_reader') THEN CREATE ROLE community_reader LOGIN PASSWORD '${secret.reader}'; END IF;
  END $$;
  GRANT CONNECT ON DATABASE relief TO community_writer,community_reader;
  GRANT USAGE ON SCHEMA community_v1 TO community_writer,community_reader;
  GRANT SELECT ON ALL TABLES IN SCHEMA community_v1 TO community_writer,community_reader;
  GRANT INSERT ON community_v1.batches,community_v1.reports,community_v1.report_places TO community_writer;
  COMMIT;
  SELECT json_build_object('sites',COUNT(*),'map_revisions',COUNT(DISTINCT map_revision),'revision',MIN(map_revision)) FROM community_v1.sites;`, 'relief_owner');
const access = JSON.parse(await communityPsql(`SELECT json_build_object(
  'writer_reads_stock',has_table_privilege('community_writer','public.inventory','SELECT'),
  'writer_updates_reports',has_table_privilege('community_writer','community_v1.reports','UPDATE'),
  'reader_inserts_reports',has_table_privilege('community_reader','community_v1.reports','INSERT'),
  'site_count',(SELECT COUNT(*) FROM community_v1.sites),
  'map_match',(SELECT COUNT(*)=16 AND bool_and(map_revision='${hashEvidence(map.manifest)}') FROM community_v1.sites));`, 'relief_owner'));
if (access.writer_reads_stock || access.writer_updates_reports || access.reader_inserts_reports || !access.map_match) throw new Error('Community source privilege or map-identity gate failed.');
const client = new ZetarisClient({ baseUrl: process.env['ZETARIS_BASE_URL'] ?? 'http://127.0.0.1:3000', orgId: process.env['ZETARIS_ORG_ID'] ?? '',
  username: process.env['ZETARIS_USERNAME'], password: process.env['ZETARIS_PASSWORD'], token: process.env['ZETARIS_API_KEY'],
  fetch: async (input, init) => { const response = await fetch(input, init);
    if (!response.ok) writeFileSync('.runtime/community-v1/registration-error.json', await response.clone().text()); return response; } });
console.log('Database and privilege gates passed; checking source registration.');
const sources = await client.command('SHOW DATASOURCES');
if (!JSON.stringify(sources.data).toUpperCase().includes('PORTALONE_COMMUNITY_V1')) await client.command(`CREATE DATASOURCE PORTALONE_COMMUNITY_V1
  DESCRIBE BY "Versioned community report metadata and OSM place candidates" OPTIONS (
  jdbcdriver "org.postgresql.Driver",jdbcurl "jdbc:postgresql://portal-one-relief-db:5432/relief",username "community_reader",password "${secret.reader}",schema "community_v1")`);
for (const table of tables) {
  console.log(`Checking registered table: ${table}`);
  try { await client.query(`SELECT COUNT(*) AS n FROM PORTALONE_COMMUNITY_V1.${table}`); }
  catch { await client.command(`REGISTER DATASOURCE TABLE "${table}" FROM PORTALONE_COMMUNITY_V1`); }
}
const receipt = { ...plan, verifiedAt: new Date().toISOString(), access, sites: map.places.length,
  privacy: 'No report text, claimed reporter references or GPS copied to this source. Reader is SELECT-only; writer cannot read stock or update records.' };
writeFileSync('.runtime/community-v1/provision.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
