import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { canonicalJson, sha256Hex } from '../../../vendor/meterless-world-model/dist/index.js';
import { CandidateSchema, MissionSchema, timestamp } from './relief-data';
import type { ReliefCandidate, ReliefDataSource, ReliefMission, ReliefSnapshot, QueryReceipt } from './relief-data';
import type { ReliefObservation } from './relief-world';
import { ZetarisClient } from './zetaris';

export const scenarioDirectory = resolve('data/relief-scenario-v1');
const routeIds = ['sim-direct', 'sim-detour'];
const segmentIds = ['sim-hub-mile4', 'sim-mile4-bambili', 'sim-hub-detour', 'sim-detour-bambili'];
export function readScenario() {
  const manifest = JSON.parse(readFileSync(resolve(scenarioDirectory, 'manifest.json'), 'utf8'));
  for (const entry of manifest.files) {
    if (!/^[a-z_]+\.(json|ndjson)$/.test(entry.file)) throw new Error('Unexpected fixture filename.');
    const hash = createHash('sha256').update(readFileSync(resolve(scenarioDirectory, entry.file))).digest('hex');
    if (hash !== entry.sha256) throw new Error(`Fixture hash mismatch: ${entry.file}`);
  }
  const pack = JSON.parse(readFileSync(resolve(scenarioDirectory, 'scenario.json'), 'utf8'));
  return { ...pack, mission: MissionSchema.parse(pack.mission) };
}
function scope(mission: ReliefMission, asOf: string): string {
  MissionSchema.parse(mission);
  timestamp.parse(asOf);
  if (mission.depotId !== 'sim-bamenda-hub' || mission.destinationId !== 'sim-bambili-site' || mission.sku !== 'sim-relief-kit') {
    throw new Error('This data source covers only the labelled synthetic corridor and kit SKU.');
  }
  return new Date(asOf).toISOString();
}
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
export function reliefQueries(mission: ReliefMission, asOf: string) {
  const at = scope(mission, asOf);
  const candidates = `SELECT r.route_id, v.id AS vehicle_id,
    concat_ws(',', sort_array(collect_set(r.segment_id))) AS segment_ids,
    SUM(r.distance_km) AS distance_km, SUM(r.travel_minutes) AS travel_minutes,
    MIN(r.max_gross_kg) AS max_gross_kg,
    MAX(CASE WHEN r.requires_four_wheel_drive THEN 1 ELSE 0 END) AS requires_four_wheel_drive,
    v.payload_kg, v.tare_kg, v.fuel_litres, v.litres_per_km, v.four_wheel_drive, v.available,
    i.available_units AS stock_units, i.unit_mass_kg, i.id AS stock_id,
    GREATEST(i.observed_at, v.observed_at) AS valid_from,
    LEAST(MIN(r.expires_at), i.expires_at, v.expires_at) AS valid_until
    FROM PORTALONE_SCENARIO_V1.route_segments r
    CROSS JOIN PORTALONE_LOGISTICS_V1.vehicles v
    JOIN PORTALONE_LOGISTICS_V1.inventory i ON i.depot_id = v.depot_id
    WHERE i.depot_id = ${literal(mission.depotId)} AND i.sku = ${literal(mission.sku)}
      AND r.route_id IN (${routeIds.map(literal).join(',')}) AND r.simulated = true AND i.simulated = true AND v.simulated = true
    GROUP BY r.route_id, v.id, v.payload_kg, v.tare_kg, v.fuel_litres, v.litres_per_km,
      v.four_wheel_drive, v.available, i.available_units, i.unit_mass_kg, i.id,
      i.observed_at, v.observed_at, i.expires_at, v.expires_at
    ORDER BY r.route_id, vehicle_id LIMIT 50`;
  const observations = `SELECT id, origin_id, source_id, segment_id, claim, observed_at, expires_at, forwarded, simulated
    FROM (SELECT id, origin_id, source_id, segment_id, claim, observed_at, expires_at, forwarded, simulated,
      ROW_NUMBER() OVER (PARTITION BY origin_id, segment_id ORDER BY observed_at DESC, forwarded ASC, id ASC) AS rn
      FROM PORTALONE_SCENARIO_V1.observations
      WHERE segment_id IN (${segmentIds.map(literal).join(',')})
        AND CAST(observed_at AS TIMESTAMP) <= CAST(${literal(at)} AS TIMESTAMP) AND simulated = true) ranked
    WHERE rn = 1 ORDER BY segment_id, origin_id LIMIT 50`;
  return [{ name: 'candidate-logistics-join', sql: candidates }, { name: 'latest-origin-observations', sql: observations }];
}
function bool(value: unknown): boolean {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  throw new Error('Invalid source boolean.');
}
export function mapObservation(row: Record<string, unknown>): ReliefObservation {
  if (!['passable', 'blocked'].includes(String(row['claim'])) || !bool(row['simulated'])) throw new Error('Invalid synthetic observation.');
  return { id: String(row['id']), originId: String(row['origin_id']), sourceId: String(row['source_id']),
    sourceKind: 'file', segmentId: String(row['segment_id']), claim: row['claim'] as 'passable' | 'blocked',
    observedAt: timestamp.parse(row['observed_at']), expiresAt: timestamp.parse(row['expires_at']),
    forwarded: bool(row['forwarded']), simulated: true };
}
function snapshot(mode: ReliefSnapshot['mode'], asOf: string, candidates: ReliefCandidate[],
  observations: ReliefObservation[], queries: QueryReceipt[]): ReliefSnapshot {
  candidates.sort((a, b) => `${a.routeId}:${a.vehicleId}`.localeCompare(`${b.routeId}:${b.vehicleId}`));
  observations.sort((a, b) => a.id.localeCompare(b.id));
  return { mode, asOf, candidates, observations, queries,
    dataRevision: sha256Hex(canonicalJson({ candidates, observations })) };
}

export class ZetarisReliefSource implements ReliefDataSource {
  constructor(private readonly client: ZetarisClient) {}
  async load(mission: ReliefMission, asOf: string, signal?: AbortSignal): Promise<ReliefSnapshot> {
    const tables: Record<string, unknown>[][] = [];
    const receipts: QueryReceipt[] = [];
    for (const query of reliefQueries(mission, asOf)) {
      signal?.throwIfAborted();
      const start = performance.now();
      const result = await this.client.query(query.sql, signal);
      tables.push(result.data.map(values => Object.fromEntries(result.headers.map((name, i) => [name, values[i]]))));
      receipts.push({ id: `query-${randomUUID()}`, name: query.name,
        sql: query.sql, asOf, fetchedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - start),
        rowCount: result.data.length, resultHash: sha256Hex(canonicalJson(result.data)) });
    }
    const candidates = tables[0]!.map(row => CandidateSchema.parse({
      routeId: row['route_id'], vehicleId: row['vehicle_id'], segmentIds: String(row['segment_ids']).split(','),
      distanceKm: Number(row['distance_km']), travelMinutes: Number(row['travel_minutes']),
      maxGrossKg: Number(row['max_gross_kg']), requiresFourWheelDrive: bool(row['requires_four_wheel_drive']),
      payloadKg: Number(row['payload_kg']), tareKg: Number(row['tare_kg']), fuelLitres: Number(row['fuel_litres']),
      litresPerKm: Number(row['litres_per_km']), fourWheelDrive: bool(row['four_wheel_drive']), available: bool(row['available']),
      stockUnits: Number(row['stock_units']), unitMassKg: Number(row['unit_mass_kg']),
      validFrom: row['valid_from'], validUntil: row['valid_until'],
      evidenceIds: [String(row['stock_id']), String(row['vehicle_id']), ...String(row['segment_ids']).split(',')], simulated: true,
    }));
    return snapshot('live-zetaris-synthetic', asOf, candidates, tables[1]!.map(mapObservation), receipts);
  }
}

/** Explicit offline fixture; does not impersonate a sponsor query or model call. */
export class FixtureReliefSource implements ReliefDataSource {
  async load(mission: ReliefMission, asOf: string, signal?: AbortSignal): Promise<ReliefSnapshot> {
    signal?.throwIfAborted();
    const at = scope(mission, asOf);
    const pack = readScenario();
    const candidates: ReliefCandidate[] = [];
    for (const routeId of routeIds) {
      const segments = pack.segments.filter((row: any) => row.route_id === routeId);
      for (const vehicle of pack.vehicles) {
        const stock = pack.inventory.find((row: any) => row.depot_id === mission.depotId && row.sku === mission.sku);
        if (!stock || vehicle.depot_id !== mission.depotId) continue;
        const ids: string[] = segments.map((row: any) => row.segment_id).sort();
        candidates.push(CandidateSchema.parse({ routeId, vehicleId: vehicle.id, segmentIds: ids,
          distanceKm: segments.reduce((n: number, row: any) => n + row.distance_km, 0),
          travelMinutes: segments.reduce((n: number, row: any) => n + row.travel_minutes, 0),
          maxGrossKg: Math.min(...segments.map((row: any) => row.max_gross_kg)),
          requiresFourWheelDrive: segments.some((row: any) => row.requires_four_wheel_drive),
          payloadKg: vehicle.payload_kg, tareKg: vehicle.tare_kg, fuelLitres: vehicle.fuel_litres,
          litresPerKm: vehicle.litres_per_km, fourWheelDrive: vehicle.four_wheel_drive, available: vehicle.available,
          stockUnits: stock.available_units, unitMassKg: stock.unit_mass_kg,
          validFrom: [stock.observed_at, vehicle.observed_at].sort().at(-1),
          validUntil: [...segments.map((row: any) => row.expires_at), stock.expires_at, vehicle.expires_at].sort()[0],
          evidenceIds: [stock.id, vehicle.id, ...ids], simulated: true,
        }));
      }
    }
    const rows = JSON.parse(readFileSync(resolve(scenarioDirectory, 'observations.json'), 'utf8')) as Record<string, unknown>[];
    const latest = new Map<string, ReliefObservation>();
    for (const row of rows) {
      const item = mapObservation(row);
      if (Date.parse(item.observedAt) > Date.parse(at)) continue;
      const key = `${item.originId}:${item.segmentId}`;
      const previous = latest.get(key);
      if (!previous || Date.parse(item.observedAt) > Date.parse(previous.observedAt) ||
        (item.observedAt === previous.observedAt && previous.forwarded && !item.forwarded)) latest.set(key, item);
    }
    return snapshot('offline-fixture', asOf, candidates, [...latest.values()], []);
  }
}
