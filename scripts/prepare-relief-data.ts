import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { MissionSchema } from '../src/lib/server/relief-data';

const directory = resolve('data/relief-scenario-v1');
const pack = JSON.parse(readFileSync(resolve(directory, 'scenario.json'), 'utf8'));
MissionSchema.parse(pack.mission);
if (pack.simulated !== true || pack.id !== 'relief-scenario-v1') throw new Error('Expected the synthetic v1 pack.');
for (const routeId of new Set(pack.segments.map((row: any) => row.route_id))) {
  const segments = pack.segments.filter((row: any) => row.route_id === routeId)
    .sort((a: any, b: any) => a.sequence - b.sequence);
  if (segments[0].from_node !== pack.mission.depotId || segments.at(-1).to_node !== pack.mission.destinationId ||
    segments.some((row: any, i: number) => row.sequence !== i + 1 || (i && segments[i - 1].to_node !== row.from_node))) {
    throw new Error('A fixture route is disconnected.');
  }
}
const observations = pack.segments.flatMap((segment: any) => [1, 2].map(index => ({
  id: `${segment.segment_id}-report-${index}`, origin_id: `sim-origin-${index}`, source_id: `sim-source-${index}`,
  segment_id: segment.segment_id, claim: 'passable', observed_at: '2026-10-24T08:50:00Z',
  expires_at: '2026-10-24T11:00:00Z', forwarded: false, simulated: true,
})));
observations.push({ ...observations[0], id: 'sim-forward-1', source_id: 'sim-social-relay', forwarded: true });
observations.push({ id: 'sim-new-blockade', origin_id: 'sim-origin-3', source_id: 'sim-source-3',
  segment_id: 'sim-mile4-bambili', claim: 'blocked', observed_at: pack.changedAt,
  expires_at: '2026-10-24T11:00:00Z', forwarded: false, simulated: true });
const files = { 'route_segments.json': pack.segments, 'observations.json': observations,
  'inventory.ndjson': pack.inventory, 'vehicles.ndjson': pack.vehicles };
mkdirSync(directory, { recursive: true });
for (const [filename, rows] of Object.entries(files)) {
  writeFileSync(resolve(directory, filename), filename.endsWith('.json') ? JSON.stringify(rows, null, 2) + '\n'
    : rows.map((row: unknown) => JSON.stringify(row)).join('\n') + '\n');
}
const manifest = { id: pack.id, revision: pack.revision, simulated: true, license: 'CC0-1.0',
  author: 'PortalOne team with Codex assistance', createdOn: '2026-10-24',
  files: ['scenario.json', ...Object.keys(files)].map(file => ({ file,
    sha256: createHash('sha256').update(readFileSync(resolve(directory, file))).digest('hex'),
    rows: file === 'scenario.json' ? null : (files as Record<string, unknown[]>)[file]!.length })),
  sources: { postgres: ['inventory', 'vehicles'], files: ['route_segments', 'observations'] },
  limits: 'Entirely synthetic. Fixed simulation clock. No real field reports, surveyed detour or operational safety claim.' };
writeFileSync(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ prepared: pack.id, rowCounts: manifest.files.map(f => ({ file: f.file, rows: f.rows })) }));
