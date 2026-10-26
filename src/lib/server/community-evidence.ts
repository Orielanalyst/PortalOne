import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { z } from 'zod';
import type { KoboSnapshot } from './kobo';
import { CommunityMap } from './community-map';
import type { Grounding } from './community-map';
import { configuredZetaris } from './zetaris';
import type { ZetarisClient } from './zetaris';
import { readScenario } from './relief-source';
import type { QueryReceipt } from './relief-data';
import type { PublicSnapshot } from './public-evidence';
import type { publicRequirements } from './mission-requirements';

export const hashEvidence = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export type EvidenceProjection = { id: string; sourceId: string; mapRevision: string; count: number;
  reports: { signal_id: string; mode: 'demo' | 'live'; category: string; relation: string; observed_at: string;
    ground_status: Grounding['status']; candidate_count: number; origin_verified: false }[];
  places: { signal_id: string; place_id: string }[] };
export function projectEvidence(snapshot: KoboSnapshot, map: CommunityMap): EvidenceProjection {
  if (snapshot.count !== snapshot.records.length || snapshot.count > 1000) throw new Error('Incomplete evidence projection.');
  const reports: EvidenceProjection['reports'] = [], places: EvidenceProjection['places'] = [];
  for (const { signal } of snapshot.records) {
    const grounding = map.resolve(signal);
    reports.push({ signal_id: signal.id, mode: signal.mode, category: signal.category, relation: signal.relation, observed_at: signal.observedAt,
      ground_status: grounding.status, candidate_count: grounding.candidates.length, origin_verified: false });
    for (const candidate of grounding.candidates) places.push({ signal_id: signal.id, place_id: candidate.id });
  }
  reports.sort((a, b) => a.signal_id.localeCompare(b.signal_id));
  if (new Set(reports.map(r => r.signal_id)).size !== reports.length) throw new Error('Repeated signal version in evidence projection.');
  places.sort((a, b) => `${a.signal_id}:${a.place_id}`.localeCompare(`${b.signal_id}:${b.place_id}`));
  const body = { sourceId: hashEvidence(snapshot.sourceId), mapRevision: hashEvidence(map.manifest), count: snapshot.count, reports, places };
  return { id: hashEvidence(body), ...body };
}
export async function communityPsql(sql: string, role = 'community_writer', signal?: AbortSignal): Promise<string> {
  if (!['community_writer', 'relief_owner'].includes(role) || Buffer.byteLength(sql) > 2_000_000) throw new Error('Invalid intake database operation.');
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = execFile('docker', ['exec', '-i', 'portal-one-relief-db', 'psql', '-X', '-q', '-A', '-t', '-w', '-U', role, '-d', 'relief', '-v', 'ON_ERROR_STOP=1'],
      { timeout: 30_000, maxBuffer: 1_000_000, windowsHide: true, signal }, (error, stdout) => {
        if (error) reject(new Error('Community database operation failed; private diagnostics excluded.'));
        else resolve(stdout.trim());
      });
    child.stdin?.on('error', () => { /* execFile reports a failed child without leaking its input. */ });
    child.stdin?.end(sql);
  });
}
export function projectionSql(projection: EvidenceProjection) {
  if (![projection.id, projection.sourceId, projection.mapRevision].every(value => /^[a-f0-9]{64}$/.test(value)) ||
      projection.count !== projection.reports.length) throw new Error('Invalid evidence projection identifier or count.');
  // Payload is base64 data, never SQL syntax. Only this code owns identifiers and statements.
  const payload = Buffer.from(JSON.stringify(projection)).toString('base64');
  return `BEGIN; SET LOCAL statement_timeout='20s';
    CREATE TEMP TABLE input_projection ON COMMIT DROP AS SELECT convert_from(decode('${payload}','base64'),'UTF8')::jsonb AS doc;
    INSERT INTO community_v1.batches(id,source_id,map_revision,report_count)
      SELECT doc->>'id',doc->>'sourceId',doc->>'mapRevision',(doc->>'count')::integer FROM input_projection ON CONFLICT(id) DO NOTHING;
    INSERT INTO community_v1.reports(batch_id,signal_id,mode,category,relation,observed_at,ground_status,candidate_count,origin_verified)
      SELECT doc->>'id',r.signal_id,r.mode,r.category,r.relation,r.observed_at,r.ground_status,r.candidate_count,false
      FROM input_projection CROSS JOIN LATERAL jsonb_to_recordset(doc->'reports') AS r(signal_id text,mode text,category text,relation text,
        observed_at text,ground_status text,candidate_count integer) ON CONFLICT(batch_id,signal_id) DO NOTHING;
    INSERT INTO community_v1.report_places(batch_id,signal_id,place_id)
      SELECT doc->>'id',p.signal_id,p.place_id FROM input_projection
      CROSS JOIN LATERAL jsonb_to_recordset(doc->'places') AS p(signal_id text,place_id text) ON CONFLICT DO NOTHING;
    SELECT json_build_object('batch',b.id,'reports',COUNT(r.signal_id)) FROM community_v1.batches b
      LEFT JOIN community_v1.reports r ON r.batch_id=b.id WHERE b.id='${projection.id}' GROUP BY b.id;
    COMMIT;`;
}
const integer = z.coerce.number().int().nonnegative();
export const EvidenceRowSchema = z.object({ placeId: z.string(), name: z.string(), reports: integer, demo: integer, live: integer,
  ambiguous: integer, unlocated: integer, blockers: integer, verifiedOrigins: z.literal(0),
  stockUnits: integer.nullable(), unitMassKg: z.coerce.number().positive().nullable(), stockObservedAt: z.string().nullable(), stockValidUntil: z.string().nullable(),
  fleetCount: integer.nullable(), availableVehicles: integer.nullable(), fleetObservedAt: z.string().nullable(), fleetValidUntil: z.string().nullable(),
  logisticsSimulated: z.boolean(), stockFresh: z.boolean(), fleetFresh: z.boolean() }).strict();
export type EvidenceRow = z.infer<typeof EvidenceRowSchema>;
export type FederatedEvidence = { mode: 'live-zetaris' | 'offline-fixture'; inputRevision: string; revision: string; sourceId: string;
  fetchedAt: string; reportCount: number; demoCount: number; liveCount: number; forwardedCount: number; rows: EvidenceRow[]; queries: QueryReceipt[];
  publicEvidence?: PublicSnapshot; requirements?:ReturnType<typeof publicRequirements>; dependencyBaseRevision?:string };
export interface MissionEvidence { load(snapshot: KoboSnapshot, signal: AbortSignal,options?:{freshPublic?:boolean}): Promise<FederatedEvidence> }
export function communityQueries(batchId: string) {
  if (!/^[a-f0-9]{64}$/.test(batchId)) throw new Error('Invalid evidence batch ID.');
  return [
    { name: 'community-batch-summary', sql: `SELECT b.id,b.report_count,COUNT(r.signal_id) AS actual_count,
      COUNT(CASE WHEN r.mode='demo' THEN 1 END) AS demo_count,COUNT(CASE WHEN r.mode='live' THEN 1 END) AS live_count,
      COUNT(CASE WHEN r.relation='forwarded' THEN 1 END) AS forwarded_count
      FROM PORTALONE_COMMUNITY_V1.batches b LEFT JOIN PORTALONE_COMMUNITY_V1.reports r ON r.batch_id=b.id
      WHERE b.id='${batchId}' GROUP BY b.id,b.report_count LIMIT 2` },
    { name: 'community-logistics-join', sql: `SELECT c.place_id,COALESCE(s.name,'Unresolved community') AS place_name,s.map_revision AS site_map_revision,
      c.reports,c.demo,c.live,c.ambiguous,c.unlocated,c.blockers,c.verified_origins,
      i.available_units AS stock_units,i.unit_mass_kg,i.observed_at AS stock_observed_at,i.expires_at AS stock_valid_until,
      v.fleet_count,v.available_vehicles,v.fleet_observed_at,v.fleet_valid_until,m.simulated AS logistics_simulated
      FROM (SELECT p.place_id,COUNT(DISTINCT r.signal_id) AS reports,
        COUNT(DISTINCT CASE WHEN r.mode='demo' THEN r.signal_id END) AS demo,
        COUNT(DISTINCT CASE WHEN r.mode='live' THEN r.signal_id END) AS live,
        COUNT(DISTINCT CASE WHEN r.ground_status='ambiguous' THEN r.signal_id END) AS ambiguous,
        COUNT(DISTINCT CASE WHEN r.ground_status<>'named_place' THEN r.signal_id END) AS unlocated,
        COUNT(DISTINCT CASE WHEN r.category='road_blockage' THEN r.signal_id END) AS blockers,
        COUNT(DISTINCT CASE WHEN r.origin_verified=true THEN r.signal_id END) AS verified_origins
        FROM PORTALONE_COMMUNITY_V1.reports r LEFT JOIN PORTALONE_COMMUNITY_V1.report_places p
          ON p.batch_id=r.batch_id AND p.signal_id=r.signal_id
        WHERE r.batch_id='${batchId}' GROUP BY p.place_id) c
      LEFT JOIN PORTALONE_COMMUNITY_V1.sites s ON s.place_id=c.place_id
      LEFT JOIN PORTALONE_COMMUNITY_V1.logistics_scope m ON m.place_id=c.place_id
      LEFT JOIN PORTALONE_LOGISTICS_V1.inventory i ON i.depot_id=m.depot_id AND i.sku='sim-relief-kit' AND i.simulated=true
      LEFT JOIN (SELECT depot_id,COUNT(*) AS fleet_count,COUNT(CASE WHEN available=true THEN 1 END) AS available_vehicles,
        MAX(observed_at) AS fleet_observed_at,MIN(expires_at) AS fleet_valid_until FROM PORTALONE_LOGISTICS_V1.vehicles WHERE simulated=true GROUP BY depot_id) v ON v.depot_id=m.depot_id
      ORDER BY c.place_id LIMIT 49` },
  ];
}
function rowFromSql(row: Record<string, unknown>, now: number): EvidenceRow {
  const fresh = (from: unknown, until: unknown) => typeof from === 'string' && typeof until === 'string' &&
    Number.isFinite(Date.parse(from)) && Number.isFinite(Date.parse(until)) && Date.parse(from) <= now && Date.parse(until) > now;
  return EvidenceRowSchema.parse({ placeId: row['place_id'] ?? 'unresolved', name: row['place_name'], reports: row['reports'],
    demo: row['demo'], live: row['live'], ambiguous: row['ambiguous'], unlocated: row['unlocated'], blockers: row['blockers'],
    verifiedOrigins: Number(row['verified_origins']), stockUnits: row['stock_units'], unitMassKg: row['unit_mass_kg'],
    stockObservedAt: row['stock_observed_at'], stockValidUntil: row['stock_valid_until'], fleetCount: row['fleet_count'], availableVehicles: row['available_vehicles'],
    fleetObservedAt: row['fleet_observed_at'], fleetValidUntil: row['fleet_valid_until'], logisticsSimulated: row['logistics_simulated'] === true || row['logistics_simulated'] === 'true',
    stockFresh: fresh(row['stock_observed_at'], row['stock_valid_until']), fleetFresh: fresh(row['fleet_observed_at'], row['fleet_valid_until']) });
}
export function finishEvidence(projection: EvidenceProjection, mode: FederatedEvidence['mode'], rows: EvidenceRow[], queries: QueryReceipt[]): FederatedEvidence {
  const demoCount = projection.reports.filter(r => r.mode === 'demo').length;
  return { mode, sourceId: projection.sourceId, inputRevision: projection.id, fetchedAt: new Date().toISOString(),
    revision: hashEvidence({ input: projection.id, rows }), reportCount: projection.count, demoCount,
    liveCount: projection.count - demoCount, forwardedCount: projection.reports.filter(r => r.relation === 'forwarded').length, rows, queries };
}
function reportGroups(projection: EvidenceProjection) {
  const links = new Map<string, string[]>(), groups = new Map<string, EvidenceProjection['reports']>();
  for (const item of projection.places) links.set(item.signal_id, [...(links.get(item.signal_id) ?? []), item.place_id]);
  for (const report of projection.reports) for (const id of links.get(report.signal_id) ?? ['unresolved']) groups.set(id, [...(groups.get(id) ?? []), report]);
  return groups;
}
export class ZetarisCommunityEvidence implements MissionEvidence {
  constructor(private readonly map: CommunityMap, private readonly client: Pick<ZetarisClient, 'query'> = configuredZetaris(),
    private readonly write: typeof communityPsql = communityPsql) {}
  async load(snapshot: KoboSnapshot, signal: AbortSignal) {
    const projection = projectEvidence(snapshot, this.map);
    const committed = JSON.parse(await this.write(projectionSql(projection), 'community_writer', signal));
    if (committed.batch !== projection.id || committed.reports !== projection.count) throw new Error('Community projection was not committed completely.');
    const tables: Record<string, unknown>[][] = [], queries: QueryReceipt[] = [];
    for (const query of communityQueries(projection.id)) {
      signal.throwIfAborted(); const started = performance.now();
      const result = await this.client.query(query.sql, signal);
      tables.push(result.data.map(values => Object.fromEntries(result.headers.map((header, i) => [header, values[i]]))));
      queries.push({ id: `query-${randomUUID()}`, name: query.name, sql: query.sql, asOf: snapshot.checkedAt,
        fetchedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - started), rowCount: result.data.length, resultHash: hashEvidence(result.data) });
    }
    const summary = tables[0];
    if (summary?.length !== 1 || summary[0]?.['id'] !== projection.id || Number(summary[0]['actual_count']) !== projection.count ||
      Number(summary[0]['report_count']) !== projection.count || Number(summary[0]['demo_count']) !== projection.reports.filter(r => r.mode === 'demo').length ||
      Number(summary[0]['live_count']) !== projection.reports.filter(r => r.mode === 'live').length ||
      Number(summary[0]['forwarded_count']) !== projection.reports.filter(r => r.relation === 'forwarded').length) throw new Error('Federated batch verification failed.');
    for (const row of tables[1]!) if (row['place_id'] !== null && row['site_map_revision'] !== projection.mapRevision) throw new Error('Federated place map revision mismatch.');
    const rows = tables[1]!.map(row => rowFromSql(row, Date.now())).sort((a, b) => a.placeId.localeCompare(b.placeId));
    if (projection.count > 0 && !rows.length) throw new Error('Federated community join was empty.');
    if (rows.length > this.map.places.length + 1 || new Set(rows.map(r => r.placeId)).size !== rows.length) throw new Error('Unexpected community join fan-out.');
    const expectedGroups = reportGroups(projection);
    if (rows.length !== expectedGroups.size) throw new Error('Federated community groups were incomplete.');
    for (const row of rows) {
      const expected = expectedGroups.get(row.placeId);
      if (!expected || row.reports !== expected.length || row.demo !== expected.filter(r => r.mode === 'demo').length ||
        row.live !== expected.filter(r => r.mode === 'live').length || row.ambiguous !== expected.filter(r => r.ground_status === 'ambiguous').length ||
        row.unlocated !== expected.filter(r => r.ground_status !== 'named_place').length || row.blockers !== expected.filter(r => r.category === 'road_blockage').length ||
        row.name !== (this.map.places.find(p => p.id === row.placeId)?.name ?? 'Unresolved community')) throw new Error('Federated report-group verification failed.');
    }
    return finishEvidence(projection, 'live-zetaris', rows, queries);
  }
}
/** Same context contract, explicitly enumerated fixtures with no HTTP/SQL calls. */
export class FixtureCommunityEvidence implements MissionEvidence {
  constructor(private readonly map: CommunityMap) {}
  async load(snapshot: KoboSnapshot, signal: AbortSignal) {
    signal.throwIfAborted(); const projection = projectEvidence(snapshot, this.map); const pack = readScenario();
    const groups = reportGroups(projection);
    const rows = [...groups.entries()].map(([id, reports]) => {
      const stock = id === 'places-node:1744470346' ? pack.inventory[0] : null;
      return rowFromSql({ place_id: id, place_name: this.map.places.find(p => p.id === id)?.name ?? 'Unresolved community',
        reports: reports.length, demo: reports.filter(r => r.mode === 'demo').length, live: reports.filter(r => r.mode === 'live').length,
        ambiguous: reports.filter(r => r.ground_status === 'ambiguous').length, unlocated: reports.filter(r => r.ground_status !== 'named_place').length,
        blockers: reports.filter(r => r.category === 'road_blockage').length, verified_origins: 0, stock_units: stock?.available_units ?? null,
        unit_mass_kg: stock?.unit_mass_kg ?? null, stock_observed_at: stock?.observed_at ?? null, stock_valid_until: stock?.expires_at ?? null, fleet_count: stock ? pack.vehicles.length : null,
        available_vehicles: stock ? pack.vehicles.filter((v: any) => v.available).length : null,
        fleet_observed_at: stock ? [...pack.vehicles.map((v: any) => v.observed_at)].sort().at(-1) : null,
        fleet_valid_until: stock ? [...pack.vehicles.map((v: any) => v.expires_at)].sort()[0] : null, logistics_simulated: !!stock }, Date.now());
    }).sort((a, b) => a.placeId.localeCompare(b.placeId));
    return finishEvidence(projection, 'offline-fixture', rows, []);
  }
}
