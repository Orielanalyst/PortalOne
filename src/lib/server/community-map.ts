import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { FeatureCollection, Point } from 'geojson';
import type { CommunitySignal } from './kobo';

export type MapPlace = { id: string; name: string; kind: string; lat: number; lng: number };
export type Grounding = { signalId: string; status: 'named_place' | 'ambiguous' | 'unresolved' | 'reported_gps';
  candidates: MapPlace[]; location: { lat: number; lng: number } | null; gap: string | null };
const normalized = (name: string) => name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export class CommunityMap {
  readonly manifest: { version: string; attribution: string; license: string; licenseUrl: string; bounds: number[];
    limits: string; files: { file: string; sha256: string; features: number }[] };
  readonly layers: Record<string, FeatureCollection> = {};
  readonly places: MapPlace[];
  constructor(directory = resolve('data/community-map-v1')) {
    this.manifest = JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8'));
    for (const layer of this.manifest.files) {
      const bytes = readFileSync(resolve(directory, layer.file));
      if (createHash('sha256').update(bytes).digest('hex') !== layer.sha256) throw new Error(`Map integrity mismatch: ${layer.file}.`);
      this.layers[layer.file.replace('.geojson', '')] = JSON.parse(bytes.toString('utf8'));
    }
    this.places = (this.layers['places']?.features ?? []).flatMap(f => f.geometry.type === 'Point' && f.properties?.['name'] ? [{
      id: String(f.properties['evidenceId']), name: String(f.properties['name']), kind: String(f.properties['place'] ?? 'place'),
      lng: (f.geometry as Point).coordinates[0]!, lat: (f.geometry as Point).coordinates[1]!,
    }] : []);
  }
  resolve(signal: CommunitySignal): Grounding {
    const candidates = this.places.filter(p => normalized(p.name) === normalized(signal.placeName));
    if (signal.location) {
      const { lng, lat } = signal.location;
      const [west, south, east, north] = this.manifest.bounds as [number, number, number, number];
      if (lng < west || lng > east || lat < south || lat > north) return { signalId: signal.id, status: 'unresolved', candidates,
        location: null, gap: 'Reported GPS falls outside the acquired map extent; local verification required.' };
      // Public workspace rounds report coordinates to ~100m; raw GPS remains in the private journal.
      return { signalId: signal.id, status: 'reported_gps', candidates, location: { lat: +lat.toFixed(3), lng: +lng.toFixed(3) },
        gap: 'Reporter-supplied GPS is unverified; approximate display does not identify a road segment.' };
    }
    return { signalId: signal.id, status: candidates.length === 1 ? 'named_place' : candidates.length ? 'ambiguous' : 'unresolved', candidates,
      location: candidates.length === 1 ? { lat: candidates[0]!.lat, lng: candidates[0]!.lng } : null,
      gap: candidates.length === 1 ? 'Community label matched; the exact incident location and affected road remain unknown.'
        : candidates.length ? 'Multiple mapped places have this name; GPS or local clarification is required.'
          : 'No exact mapped place match; request a landmark or GPS rather than inventing coordinates.' };
  }
}
