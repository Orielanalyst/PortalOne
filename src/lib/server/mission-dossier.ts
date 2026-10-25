import { createHash } from 'node:crypto';
import type { Feature, FeatureCollection, Position } from 'geojson';
import type { EvidenceCitation } from '../mission-artifacts';
import type { CommunityMap } from './community-map';
import type { KoboSnapshot } from './kobo';
import type { FederatedEvidence } from './community-evidence';

export type MissionDossier = { runId: string; objective: string; capturedAt: string; revision: string;
  citations: EvidenceCitation[]; modelEvidence: EvidenceCitation[]; gaps: string[];
  layers: Record<string, FeatureCollection>; bounds: number[]; attribution: string; mapVersion: string };
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const coordinate = (value: unknown): Position | null => {
  if (!Array.isArray(value)) return null;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') return value as Position;
  return coordinate(value[0]);
};
const collection = (features: Feature[]): FeatureCollection => ({ type: 'FeatureCollection', features });
export function buildDossier(runId: string, objective: string, snapshot: KoboSnapshot, evidence: FederatedEvidence, map: CommunityMap): MissionDossier {
  const citations: EvidenceCitation[] = [];
  function cite(kind: EvidenceCitation['kind'], key: string, title: string, statement: string, sourceUrl: string | null, observedAt: string | null = null) {
    const id = `E${digest([kind,key,statement]).slice(0, 10)}`;
    citations.push({ id, runId, kind, title, statement, sourceUrl, observedAt, recordId: key, sha256: digest(statement) }); return id;
  }
  cite('mission','operator', 'Operator mission objective', objective, null);
  const mapId = cite('map',map.manifest.version,'Acquired map extent and coverage',
    `OpenStreetMap/HOT extract ${map.manifest.version}: ${map.layers['roads']!.features.length} road-related features, ${map.places.length} named settlement candidates and ${map.layers['facilities']!.features.length} health features. Bounds ${JSON.stringify(map.manifest.bounds)} in EPSG:4326. Coverage, current road passability and facility operation are unverified.`,
    'https://data.humdata.org/dataset/hotosm_cmr_health_facilities');
  const facilities = map.layers['facilities']!.features.map(feature => {
    const xy = coordinate('coordinates' in feature.geometry ? feature.geometry.coordinates : null);
    if (!xy) throw new Error('Facility coordinate is missing.');
    const name = String(feature.properties?.['name'] ?? `Unnamed health feature ${feature.properties?.['id']}`);
    const kind = String(feature.properties?.['healthcare'] ?? feature.properties?.['amenity'] ?? 'health feature');
    const url = `https://www.openstreetmap.org/${String(feature.properties?.['id'])}`;
    const basis = feature.geometry.type === 'Point' ? 'mapped_point_not_verified_entrance' : 'source_boundary_vertex_not_verified_entrance';
    const id = cite('facility',String(feature.id),name, `${name}; source classification ${kind}; reference longitude ${xy[0]}, latitude ${xy[1]}; coordinate basis ${basis}; capacity and operating status are not provided by this source.`, url);
    return { type: 'Feature' as const, id: feature.id, geometry: { type: 'Point' as const, coordinates: xy }, properties: {
      name, type: kind, longitude: xy[0], latitude: xy[1], coordinate_basis: basis, capacity: null, operation: 'unverified', evidence_id: id, source_url: url,
    } };
  });
  for (const place of map.places) cite('community',place.id,place.name,
    `${place.name}: mapped ${place.kind} at longitude ${place.lng}, latitude ${place.lat}. A settlement reference point does not locate an incident or define an intervention boundary.`,
    `https://www.openstreetmap.org/${place.id.replace('places-', '').replace(':','/')}`);
  const blockages: Feature[] = [], candidates: Feature[] = [];
  const missing: string[] = [];
  for (const { signal } of snapshot.records) {
    const grounding = map.resolve(signal);
    const id = cite('report',signal.id,`${signal.placeName} · ${signal.category.replaceAll('_',' ')}`,
      `${signal.mode === 'demo' ? 'Demonstration' : 'Live-labelled, unverified'} ${signal.category.replaceAll('_',' ')} report for ${signal.placeName}; relationship ${signal.relation}; observed ${signal.observedAt}. ${grounding.gap} Origin is unverified.`, null, signal.observedAt);
    if (['road_blockage','access_restriction'].includes(signal.category)) {
      if (grounding.status === 'reported_gps' && grounding.location) blockages.push({ type:'Feature',id:signal.id,
        geometry:{type:'Point',coordinates:[grounding.location.lng,grounding.location.lat]},properties:{name:`${signal.placeName} reported access constraint`,status:'reported_unverified',mode:signal.mode,evidence_id:id,precision:'rounded_approximately_100m',road_segment:'unconfirmed'} });
      else missing.push(`${signal.id}: reported ${signal.category.replaceAll('_',' ')} has no usable incident coordinate; it is excluded from the blockage point layer.`);
    }
    for (const place of grounding.candidates) if (!candidates.some(feature => feature.id === place.id)) candidates.push({ type:'Feature',id:place.id,
      geometry:{type:'Point',coordinates:[place.lng,place.lat]},properties:{name:place.name,status:'verification_candidate_not_delivery_zone',ambiguous:grounding.status === 'ambiguous',evidence_id:id} });
  }
  const gaps = [...new Set([
    'Facility capacity, operating hours, services and current availability require direct confirmation; mapped health features are not an exhaustive hospital inventory.',
    'Current road passability, exact incident locations and affected road segments are unverified. No road is certified open or impassable by this map.',
    'No surveyed intervention boundaries or approved delivery zones were supplied; the intervention_zones polygon layer is intentionally empty.',
    'Cargo quantities, beneficiary requirements, dispatch resources, deadlines and an authorized operator decision must be supplied before executable delivery planning.',
    ...(evidence.demoCount ? ['Demonstration reports cannot corroborate an actual incident.'] : []),
    ...(evidence.rows.some(row => row.logisticsSimulated) ? ['Registered stock and fleet are synthetic; their values do not establish actual NGO resources.'] : []),
    ...(evidence.rows.some(row => row.stockUnits !== null && !row.stockFresh || row.fleetCount !== null && !row.fleetFresh) ? ['Registered resource observations have expired and require a current warehouse/fleet confirmation.'] : []),
    ...(snapshot.records.some(record => map.resolve(record.signal).status === 'ambiguous') ? ['Duplicate settlement names retain multiple coordinate candidates; local clarification is required.'] : []),
    ...missing,
  ])];
  cite('query',evidence.revision,'Independently queryable community/resource context',JSON.stringify({ reports:evidence.reportCount,demonstration:evidence.demoCount,liveLabelled:evidence.liveCount,forwarded:evidence.forwardedCount,communities:evidence.rows,queries:evidence.queries.map(query=>({id:query.id,name:query.name,rows:query.rowCount})) }),null,evidence.fetchedAt);
  cite('query',`gaps-${evidence.revision}`,'Required evidence gaps',gaps.join(' '),null,evidence.fetchedAt);
  const roads = map.layers['roads']!.features.filter(feature => ['LineString','MultiLineString'].includes(feature.geometry.type))
    .map(feature => ({ ...feature, properties: { ...feature.properties, passability:'unknown',evidence_id:mapId } }));
  const layers = { roads:collection(roads),facilities:collection(facilities),blockages:collection(blockages),intervention_zones:collection([]),
    intervention_candidates:collection(candidates),places:map.layers['places']!,facility_footprints:collection(map.layers['facilities']!.features.filter(feature=>feature.geometry.type !== 'Point')) };
  return {runId,objective,capturedAt:new Date().toISOString(),revision:evidence.revision,citations,
    modelEvidence:citations.filter(item=>item.kind !== 'report').concat(citations.filter(item=>item.kind==='report').slice(0,12)),gaps,layers,
    bounds:map.manifest.bounds,attribution:map.manifest.attribution,mapVersion:map.manifest.version};
}

export function validateCitedMarkdown(markdown: string, citations: EvidenceCitation[]) {
  if (markdown.length < 180 || /\b(TBD|lorem ipsum|insert here|placeholder)\b/i.test(markdown)) throw new Error('Document failed content quality checks.');
  const known = new Set(citations.map(citation=>citation.id));
  const cited = [...markdown.matchAll(/\[(E[a-f0-9]{10})\]/g)].map(match=>match[1]!);
  if (!cited.length || cited.some(id=>!known.has(id))) throw new Error('Document contains missing or unknown evidence references.');
  const paragraphs = markdown.split(/\n\s*\n/).map(block=>block.replace(/^\s*#{1,6}\s.*$/gm,'').trim()).filter(Boolean);
  const questionOnly=(block:string)=>block.split('\n').filter(line=>line.trim()).every(line=>/^\s*(?:[-*]|\d+[.)])?\s*(?:what|which|who|when|where|how|is|are|can|does|do)\b.*\?\s*$/i.test(line));
  if (paragraphs.some(block=>!(/\[E[a-f0-9]{10}\]/.test(block)) && !questionOnly(block))) throw new Error('A factual document paragraph has no evidence reference.');
  if (/<\/?(?:script|iframe|think)\b/i.test(markdown)) throw new Error('Document contains disallowed markup.');
  return [...new Set(cited)];
}
