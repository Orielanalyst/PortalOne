import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { configuredZetaris } from '../src/lib/server/zetaris';

const label = 'relief-scenario-v1';
const database = 'portal-one-relief-db';
const driver = 'zetaris-driver-1';
const network = 'zetaris_default';
const image = 'postgres@sha256:f4610795587492cd4fb887c2dc3de301b813278bb6f616992061141b5f15ac36';
const fileRoot = '/home/zetaris/customer-data/shared/portal-one-synthetic-v1';
const directory = resolve('data/relief-scenario-v1');
const runtime = resolve('.runtime/relief-scenario-v1');
const plan = { namespace: label, postgres: { database, image, network, publishedPorts: [] },
  fileRoot, registrations: ['PORTALONE_LOGISTICS_V1.inventory', 'PORTALONE_LOGISTICS_V1.vehicles',
    'PORTALONE_SCENARIO_V1.route_segments', 'PORTALONE_SCENARIO_V1.observations'],
  operation: 'Create or reuse only these owned demo resources; no platform reset or data deletion.' };
if (!process.argv.includes('--apply')) { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }

function docker(args: string[], stdin?: string, optional = false) {
  const result = Bun.spawnSync(['docker', ...args], { stdin: stdin === undefined ? undefined : Buffer.from(stdin),
    stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0 && !optional) throw new Error(`Docker ${args[0]} failed. Inspect the owned resource locally; no credentials logged.`);
  return { ok: result.exitCode === 0, text: result.stdout.toString().trim() };
}
function quote(value: unknown): string {
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('Invalid fixture number.'); return String(value); }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `'${String(value).replaceAll("'", "''")}'`;
}
function readRows(file: string): Record<string, unknown>[] {
  const content = readFileSync(resolve(directory, file), 'utf8').trim();
  return file.endsWith('.json') ? JSON.parse(content) : content.split('\n').map(line => JSON.parse(line));
}
mkdirSync(runtime, { recursive: true });
const secretFile = resolve(runtime, 'credentials.json');
const secret = existsSync(secretFile) ? JSON.parse(readFileSync(secretFile, 'utf8'))
  : { owner: randomBytes(32).toString('hex'), reader: randomBytes(32).toString('hex') };
if (!/^[a-f0-9]{64}$/.test(secret.owner) || !/^[a-f0-9]{64}$/.test(secret.reader)) throw new Error('Unexpected demo credential file.');
if (!existsSync(secretFile)) writeFileSync(secretFile, JSON.stringify(secret) + '\n', { mode: 0o600 });
const envFile = resolve(runtime, 'postgres.env');
writeFileSync(envFile, `POSTGRES_PASSWORD=${secret.owner}\n`, { mode: 0o600 });

const prior = docker(['inspect', database], undefined, true);
if (prior.ok) {
  const owned = JSON.parse(prior.text)[0];
  if (owned.Config.Labels?.['portal-one.managed'] !== label ||
      owned.Config.Image !== image || !owned.NetworkSettings.Networks[network]) throw new Error('Existing container does not match the owned demo source.');
  if (!owned.State.Running) docker(['start', database]);
} else {
  docker(['run', '-d', '--name', database, '--label', `portal-one.managed=${label}`,
    '--network', network, '--memory', '512m', '--cpus', '1', '--env-file', envFile,
    '-e', 'POSTGRES_USER=relief_owner', '-e', 'POSTGRES_DB=relief',
    '--mount', 'type=volume,source=portal-one-relief-pg-v1,target=/var/lib/postgresql/data', image]);
}
let ready = false;
for (let attempt = 0; attempt < 20; attempt++) {
  if (docker(['exec', database, 'pg_isready', '-U', 'relief_owner', '-d', 'relief'], undefined, true).ok) { ready = true; break; }
  await Bun.sleep(500);
}
if (!ready) throw new Error('Owned relief Postgres did not become ready.');
let seed = `BEGIN;
CREATE TABLE IF NOT EXISTS inventory (id text PRIMARY KEY, depot_id text NOT NULL, sku text NOT NULL,
  available_units integer NOT NULL CHECK(available_units>=0), unit_mass_kg double precision NOT NULL,
  observed_at text NOT NULL, expires_at text NOT NULL, source_id text NOT NULL, simulated boolean NOT NULL);
CREATE TABLE IF NOT EXISTS vehicles (id text PRIMARY KEY, depot_id text NOT NULL, payload_kg double precision NOT NULL,
  tare_kg double precision NOT NULL, fuel_litres double precision NOT NULL, litres_per_km double precision NOT NULL,
  four_wheel_drive boolean NOT NULL, available boolean NOT NULL, observed_at text NOT NULL, expires_at text NOT NULL,
  source_id text NOT NULL, simulated boolean NOT NULL);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='relief_reader') THEN
  CREATE ROLE relief_reader LOGIN PASSWORD ${quote(secret.reader)}; END IF; END $$;
GRANT CONNECT ON DATABASE relief TO relief_reader;
GRANT USAGE ON SCHEMA public TO relief_reader;
GRANT SELECT ON inventory, vehicles TO relief_reader;
`;
for (const table of ['inventory', 'vehicles']) {
  for (const row of readRows(`${table}.ndjson`)) {
    seed += `INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.values(row).map(quote).join(',')}) ON CONFLICT(id) DO NOTHING;\n`;
  }
}
seed += 'COMMIT;';
docker(['exec', '-i', database, 'psql', '-U', 'relief_owner', '-d', 'relief', '-v', 'ON_ERROR_STOP=1'], seed);
docker(['exec', driver, 'mkdir', '-p', fileRoot]);
for (const table of ['route_segments', 'observations']) {
  const target = `${fileRoot}/${table}.json`;
  const current = docker(['exec', driver, 'cat', target], undefined, true);
  const local = readFileSync(resolve(directory, `${table}.json`), 'utf8').trim();
  if (current.ok && current.text !== local) throw new Error('Registered v1 fixture changed. Create a new version instead.');
  if (!current.ok) docker(['cp', resolve(directory, `${table}.json`), `${driver}:${target}`]);
}
const client = configuredZetaris();
async function register(sql: string, probe: string) {
  try { await client.query(probe); return 'already queryable'; } catch { /* create if absent */ }
  await client.command(sql);
  return 'created';
}
// Discovery commands do not contain secrets. Names are private to this pack.
const logical = await client.command('SHOW DATASOURCES');
const lightning = await client.command('SHOW LIGHTNING DATABASES');
if (!JSON.stringify(logical.data).toUpperCase().includes('PORTALONE_LOGISTICS_V1')) {
  await client.command(`CREATE DATASOURCE PORTALONE_LOGISTICS_V1 DESCRIBE BY "Synthetic relief logistics v1" OPTIONS (
    jdbcdriver "org.postgresql.Driver", jdbcurl "jdbc:postgresql://${database}:5432/relief",
    username "relief_reader", password "${secret.reader}", schema "public")`);
}
for (const table of ['inventory', 'vehicles']) {
  try { await client.query(`SELECT id FROM PORTALONE_LOGISTICS_V1.${table} LIMIT 1`); }
  catch { await client.command(`REGISTER DATASOURCE TABLE "${table}" FROM PORTALONE_LOGISTICS_V1`); }
}
if (!JSON.stringify(lightning.data).toUpperCase().includes('PORTALONE_SCENARIO_V1')) {
  await client.command('CREATE LIGHTNING DATABASE PORTALONE_SCENARIO_V1 DESCRIBE BY "Synthetic relief routes and observations v1"');
}
for (const table of ['route_segments', 'observations']) {
  await register(`CREATE LIGHTNING FILESTORE TABLE ${table} FROM PORTALONE_SCENARIO_V1 FORMAT JSON OPTIONS (
    path "${fileRoot}/${table}.json")`, `SELECT COUNT(*) AS n FROM PORTALONE_SCENARIO_V1.${table}`);
}
const counts: Record<string, unknown> = {};
for (const [source, table] of [['PORTALONE_LOGISTICS_V1', 'inventory'], ['PORTALONE_LOGISTICS_V1', 'vehicles'],
  ['PORTALONE_SCENARIO_V1', 'route_segments'], ['PORTALONE_SCENARIO_V1', 'observations']]) {
  const result = await client.query(`SELECT COUNT(*) AS n FROM ${source}.${table}`);
  const actual = Number(result.data[0]?.[0]);
  const expected = readRows(`${table}.${source === 'PORTALONE_SCENARIO_V1' ? 'json' : 'ndjson'}`).length;
  if (actual !== expected) throw new Error(`Source count mismatch for ${table}.`);
  counts[`${source}.${table}`] = { actual, expected };
}
console.log(JSON.stringify({ ...plan, counts, verifiedAt: new Date().toISOString(),
  sourceRole: 'relief_reader, SELECT-only', credentialValuesLogged: false }, null, 2));
