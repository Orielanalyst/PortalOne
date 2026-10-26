import { createHash } from 'node:crypto';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import length from '@turf/length';
import type { Feature, LineString, Position } from 'geojson';
import type { CommunityMap } from './community-map';
import type { CommunitySignal } from './kobo';

export type RoadCandidate = { id: string; roadId: string; sourceUrl: string; name: string | null; highway: string | null;
  part: number; segment: number; distanceM: number; lengthM: number; geometry: LineString };
export type RoadGrounding = { signalId: string; status: 'not_access_report' | 'unlocated' | 'no_candidate' | 'candidate' | 'ambiguous';
  searchRadiusM: number | null; totalCandidates: number; truncated: boolean; candidates: RoadCandidate[]; gap: string };
type Segment = { roadId: string; name: string | null; highway: string | null; part: number; segment: number;
  coordinates: Position[]; bounds: number[]; sourceUrl: string };
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Turf supplies the geodesic operations. This adapter owns evidence identity and uncertainty policy. */
export class RoadIndex {
  readonly revision: string;
  private readonly segments: Segment[] = [];
  private loaded=false;
  constructor(private readonly map: CommunityMap) {
    this.revision = digest(map.manifest);
  }
  private prepare() {
    if(this.loaded)return;this.loaded=true;
    for (const feature of this.map.layers['roads']!.features) {
      if (!['LineString', 'MultiLineString'].includes(feature.geometry.type)) continue;
      const roadId = String(feature.properties?.['evidenceId'] ?? feature.id);
      const parts = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.type === 'MultiLineString' ? feature.geometry.coordinates : [];
      for (const [part, coordinates] of parts.entries()) for (let segment = 0; segment < coordinates.length - 1; segment++) {
        const a = coordinates[segment]!, b = coordinates[segment + 1]!;
        if (a[0] === b[0] && a[1] === b[1]) continue;
        this.segments.push({ roadId, name: feature.properties?.['name'] || null, highway: feature.properties?.['highway'] || null,
          part, segment, coordinates: [a, b], bounds: [Math.min(a[0]!, b[0]!), Math.min(a[1]!, b[1]!), Math.max(a[0]!, b[0]!), Math.max(a[1]!, b[1]!)],
          sourceUrl: `https://www.openstreetmap.org/${String(feature.properties?.['id'])}` });
      }
    }
  }
  match(signal: CommunitySignal): RoadGrounding {
    const result = (status: RoadGrounding['status'], gap: string, candidates: RoadCandidate[] = [], radius: number | null = null): RoadGrounding => ({
      signalId: signal.id, status, searchRadiusM: radius, totalCandidates: candidates.length, truncated: candidates.length > 12,
      candidates: candidates.slice(0, 12), gap });
    if (!['road_blockage', 'road_condition', 'access_restriction'].includes(signal.category)) return result('not_access_report', 'This form does not label an access report. Extracted narrative claims are reviewed separately.');
    const grounding = this.map.resolve(signal);
    if (grounding.status !== 'reported_gps' || !grounding.location) return result('unlocated', 'A settlement name does not locate an incident road. Obtain an incident coordinate or an explicit mapped road reference.');
    if (signal.location?.accuracyMetres && signal.location.accuracyMetres > 850) return result('unlocated', 'The submitted GPS accuracy is too broad for the bounded road search. Request a clearer incident reference.');
    this.prepare();
    // Match only the already rounded public reference. Raw reporter GPS never enters the shared geometry.
    const { lat, lng } = grounding.location;
    const radius = Math.max(250, (signal.location?.accuracyMetres ?? 150) + 100);
    const dy = radius / 110_000, dx = radius / (110_000 * Math.cos(lat * Math.PI / 180));
    const candidates: RoadCandidate[] = [];
    for (const item of this.segments) {
      const [west, south, east, north] = item.bounds as [number, number, number, number];
      if (east < lng - dx || west > lng + dx || north < lat - dy || south > lat + dy) continue;
      const geometry: LineString = { type: 'LineString', coordinates: item.coordinates };
      const snapped = nearestPointOnLine(geometry, [lng, lat], { units: 'meters' });
      if (!Number.isFinite(snapped.properties.pointDistance) || snapped.properties.pointDistance > radius) continue;
      candidates.push({ id: `segment-${digest([this.revision,item.roadId,item.part,item.segment,item.coordinates]).slice(0,24)}`, roadId: item.roadId, name: item.name, highway: item.highway, part: item.part, segment: item.segment,
        distanceM: Math.round(snapped.properties.pointDistance), lengthM: Math.round(length({type:'Feature',geometry,properties:{}},{units:'meters'})), geometry, sourceUrl: item.sourceUrl });
    }
    candidates.sort((a, b) => a.distanceM - b.distanceM || a.id.localeCompare(b.id));
    return result(candidates.length === 0 ? 'no_candidate' : candidates.length === 1 ? 'candidate' : 'ambiguous',
      candidates.length ? `${candidates.length} mapped segments fall within the ${radius} m search policy around a rounded report reference. These are location candidates, not verified affected roads; an operator/local reporter must resolve the relationship. ${candidates.length > 12 ? 'Only the nearest 12 are displayed; no route can treat this truncated list as complete.' : ''}`
        : 'No mapped segment falls within the bounded search. Missing map coverage or inaccurate reporting remains possible; this does not establish road clearance.', candidates, radius);
  }
  feature(candidate: RoadCandidate, signalId: string, evidenceId: string): Feature<LineString> {
    return { type: 'Feature', id: `${signalId}:${candidate.id}`, geometry: candidate.geometry,
      properties: { name: candidate.name ?? 'Unnamed mapped road segment', status: 'possible_affected_segment_unverified', signal_id: signalId,
        segment_id: candidate.id, road_id: candidate.roadId, source_url: candidate.sourceUrl, distance_m: candidate.distanceM,
        length_m: candidate.lengthM, evidence_id: evidenceId, passability: 'unknown' } };
  }
}
const indexes = new WeakMap<CommunityMap, RoadIndex>();
export function roadIndex(map: CommunityMap) { let index = indexes.get(map); if (!index) { index = new RoadIndex(map); indexes.set(map, index); } return index; }
