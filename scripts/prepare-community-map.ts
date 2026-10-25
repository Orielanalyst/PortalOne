import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import shp from 'shpjs';
import { iter } from 'but-unzip';

// OSM data discovered through HDX on 25 October. Data is ODbL, not CC0.
const sources = [
  { layer: 'roads', dataset: 'hotosm_cmr_roads', resource: 'ed7bec54-d9a0-4917-960f-11166122d840',
    url: 'https://production-raw-data-api.s3.amazonaws.com/ISO3/CMR/roads/hotosm_cmr_roads_osm_shp.zip' },
  { layer: 'places', dataset: 'hotosm_cmr_populated_places', resource: '18cfc3dd-e90d-41b8-aa36-fc25050a203c',
    url: 'https://production-raw-data-api.s3.amazonaws.com/ISO3/CMR/populated_places/hotosm_cmr_populated_places_osm_geojson.zip' },
  { layer: 'facilities', dataset: 'hotosm_cmr_health_facilities', resource: '1bfd4ef1-f8b0-4b15-b03c-1b77daa83c48',
    url: 'https://production-raw-data-api.s3.amazonaws.com/ISO3/CMR/health_facilities/hotosm_cmr_health_facilities_osm_geojson.zip' },
];
const bounds = [10.10, 5.90, 10.30, 6.10]; // Viewing extent, not an administrative boundary.
const output = resolve('data/community-map-v1');
const cache = resolve('.runtime/map-acquisition');
const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
if (existsSync(resolve(output, 'manifest.json'))) {
  const manifest = JSON.parse(readFileSync(resolve(output, 'manifest.json'), 'utf8'));
  for (const file of manifest.files) {
    if (hash(readFileSync(resolve(output, file.file))) !== file.sha256) throw new Error('Published map extract changed.');
  }
  console.log('Existing versioned map extract hashes verified.');
  process.exit(0);
}
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });
const metadata: any[] = [], files: any[] = [];
function extent(coordinates: any): number[] {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (item: any) => {
    if (Array.isArray(item) && typeof item[0] === 'number' && typeof item[1] === 'number') {
      if (!Number.isFinite(item[0]) || !Number.isFinite(item[1]) || Math.abs(item[0]) > 180 || Math.abs(item[1]) > 90) throw new Error('Invalid geographic coordinate.');
      box[0] = Math.min(box[0]!, item[0]); box[1] = Math.min(box[1]!, item[1]);
      box[2] = Math.max(box[2]!, item[0]); box[3] = Math.max(box[3]!, item[1]);
    } else if (Array.isArray(item)) item.forEach(visit);
  };
  visit(coordinates); return box;
}
const keep = ['id', 'name', 'name_en', 'name_fr', 'name:en', 'name:fr', 'highway', 'surface', 'smoothness', 'maxweight', 'width',
  'bridge', 'amenity', 'healthcare', 'place', 'osm_id', 'osm_type', 'ref', 'oneway', 'access'];
for (const source of sources) {
  const path = resolve(cache, `${source.layer}.zip`);
  let responseMetadata: any = { cached: true };
  if (!existsSync(path)) {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok || Number(response.headers.get('content-length')) > 120_000_000) throw new Error(`Map download unavailable or oversized: ${source.layer}`);
    const reader = response.body!.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length;
      if (size > 120_000_000) { await reader.cancel(); throw new Error('Map archive exceeds acquisition budget.'); }
      chunks.push(part.value);
    }
    writeFileSync(path, Buffer.concat(chunks));
    responseMetadata = { retrievedAt: new Date().toISOString(), etag: response.headers.get('etag'), lastModified: response.headers.get('last-modified') };
  }
  const bytes = readFileSync(path);
  const entries = [...iter(bytes)];
  const jsonEntry = entries.find((entry: any) => /\.geojson$/i.test(entry.filename));
  const parsed = jsonEntry ? JSON.parse(new TextDecoder().decode(await jsonEntry.read())) : await shp(bytes);
  const collections = Array.isArray(parsed) ? parsed : [parsed];
  const input = collections.flatMap((item: any) => item.features ?? []);
  const features = input.flatMap((feature: any, index: number) => {
    if (source.layer === 'places' && !feature.properties?.place) return [];
    if (!feature.geometry?.coordinates) return [];
    const box = extent(feature.geometry.coordinates);
    if (box[0]! > bounds[2]! || box[2]! < bounds[0]! || box[1]! > bounds[3]! || box[3]! < bounds[1]!) return [];
    const raw = feature.properties ?? {};
    const properties: Record<string, unknown> = Object.fromEntries(keep.filter(key => raw[key] !== undefined && raw[key] !== null).map(key => [key, raw[key]]));
    properties['layer'] = source.layer;
    properties['evidenceId'] = `${source.layer}-${raw['osm_id'] ?? raw['id'] ?? feature.id ?? index}`.replaceAll('/', ':');
    return [{ type: 'Feature', id: properties['evidenceId'], geometry: feature.geometry, properties }];
  });
  if (!features.length) throw new Error(`No ${source.layer} features in corridor extent.`);
  const file = `${source.layer}.geojson`;
  const content = JSON.stringify({ type: 'FeatureCollection', features }) + '\n';
  writeFileSync(resolve(output, file), content);
  files.push({ file, sha256: hash(content), bytes: Buffer.byteLength(content), features: features.length });
  const metadataEntry = entries.find((entry: any) => entry.filename === 'metadata.json');
  const sourceMetadata = metadataEntry ? JSON.parse(new TextDecoder().decode(await metadataEntry.read())) : null;
  metadata.push({ ...source, ...responseMetadata, localArchiveModifiedAt: statSync(path).mtime.toISOString(),
    archiveSha256: hash(bytes), archiveBytes: bytes.length, sourceFeatureCount: input.length,
    sourceMetadata });
  console.log(JSON.stringify({ layer: source.layer, selectedFeatures: features.length, bytes: Buffer.byteLength(content) }));
}
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify({
  version: 'community-map-v1', preparedAt: new Date().toISOString(), bounds,
  attribution: '© OpenStreetMap contributors; distributed through Humanitarian OpenStreetMap Team / HDX',
  license: 'ODbL-1.0', licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  selection: 'Whole features whose geographic bounding boxes overlap the viewing extent; geometries are not clipped or surveyed.',
  limits: 'Mapped geography only. No claim of current passability, facility operation, security, bridge certification or completeness.',
  parser: 'shpjs@6.2.0', sources: metadata, files,
}, null, 2) + '\n');
