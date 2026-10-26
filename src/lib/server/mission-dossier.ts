import { createHash } from 'node:crypto';
import type { Feature, FeatureCollection, Position } from 'geojson';
import type { EvidenceCitation } from '../mission-artifacts';
import type { CommunityMap } from './community-map';
import type { KoboSnapshot } from './kobo';
import type { FederatedEvidence } from './community-evidence';
import { describeMemoryChange } from './mission-world';
import type { MemoryChange } from './mission-world';
import { interpretationStatement } from './signal-interpretation';
import type { Interpretation } from './signal-interpretation';
import { roadIndex } from './spatial-grounding';
import {missionFeasibility,mappedRouter} from './mission-feasibility';
import type {MissionFeasibility} from './mission-feasibility';

export type MissionDossier = { runId: string; objective: string; capturedAt: string; revision: string;
  citations: EvidenceCitation[]; modelEvidence: Pick<EvidenceCitation,'id'|'kind'|'title'|'statement'>[]; gaps: string[];
  layers: Record<string, FeatureCollection>; bounds: number[]; attribution: string; mapVersion: string;
  planning?:MissionFeasibility;
  update?:{previousRunId:string;previousRevision:string;changes:MemoryChange[]} };
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const coordinate = (value: unknown): Position | null => {
  if (!Array.isArray(value)) return null;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') return value as Position;
  return coordinate(value[0]);
};
const collection = (features: Feature[]): FeatureCollection => ({ type: 'FeatureCollection', features });
export const calendarDays = (text:string) => text.match(/\b\d{4}-\d{2}-\d{2}(?=T|\b)/g) ?? [];
export function buildDossier(runId: string, objective: string, snapshot: KoboSnapshot, evidence: FederatedEvidence, map: CommunityMap,update?:MissionDossier['update'],interpretations:Interpretation[]=[],feedback?:{id:string;comment:string;createdAt:string}): MissionDossier {
  const citations: EvidenceCitation[] = [];
  function cite(kind: EvidenceCitation['kind'], key: string, title: string, statement: string, sourceUrl: string | null, observedAt: string | null = null) {
    const id = `E${digest([kind,key,statement]).slice(0, 10)}`;
    citations.push({ id, runId, kind, title, statement, sourceUrl, observedAt, recordId: key, sha256: digest(statement) }); return id;
  }
  cite('mission','operator', 'Operator mission objective', objective, null);
  if(feedback)cite('mission',`operator-review:${feedback.id}`,'Operator requested proposal changes',`The local operator requested a revised proposal: ${feedback.comment} This is a committee instruction, not evidence that any field condition changed. Address it where source facts and constraints allow; otherwise explain the remaining gap.`,null,feedback.createdAt);
  if(evidence.requirements)cite('mission',`requirements:${evidence.requirements.revision}`,'Source-bound operator mission requirements',
    JSON.stringify(evidence.requirements),null,evidence.requirements.updatedAt);
  if(evidence.publicEvidence) {
    const source=evidence.publicEvidence;
    cite('public',`public-source:${source.revision}`,'Public humanitarian source coverage',
      `${source.source} status: ${source.status}. Eligible reports: ${source.reports.length}. Retrieved at ${source.checkedAt}${source.cached?' (reused within the bounded fetch window)':''}. ${source.gap}`,source.sourceUrl,null);
    for(const report of source.reports)cite('public',report.id,report.title,
      `Publisher: ${report.publisher}. ${report.dateBasis==='record_created'?`Public record created at ${report.publishedAt}; updated ${report.updatedAt??'unknown'}; declared event start ${report.declaredStartAt??'unknown'}`:`Published at ${report.publishedAt}`}; this is not the observation date. Coverage: ${report.coverage.replaceAll('_',' ')}; name mentions do not confirm local conditions. ${report.excerpt?`Short publisher excerpt: ${JSON.stringify(report.excerpt)}. `:'No short complete-sentence excerpt is available. '}Observation time and corridor-specific road/facility status remain unconfirmed. Source content SHA-256: ${report.contentSha256}.`,report.url,null);
  }
  if(update)cite('memory',`${update.previousRunId}:${evidence.revision}`,'Why this mission requires a fresh review',
    `Meterless World Model marked the previous mission ${update.previousRunId} superseded after its evidence changed. This replacement reviews the new snapshot; it does not authorize dispatch. ${update.changes.length} changed facts. Summary: ${update.changes.filter(change=>change.label!=='Report/map input revision').slice(0,12).map(describeMemoryChange).join('; ') || 'The report/map revision changed'}. The mission-memory.json file preserves the complete comparison.`,null,evidence.fetchedAt);
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
  const blockages: Feature[] = [], candidates: Feature[] = [], roadCandidates: Feature[] = [];
  const accessReferences:{signalId:string;evidenceId:string;candidateRoadIds:string[];gap:string}[]=[];
  const roadsIndex=roadIndex(map);
  const missing: string[] = [];
  for (const { signal } of snapshot.records) {
    const grounding = map.resolve(signal);
    const reading=interpretations.find(item=>item.signalId===signal.id);
    const id = cite('report',signal.id,`${signal.placeName} · ${signal.category.replaceAll('_',' ')}`,
      `${signal.mode === 'demo' ? 'Demonstration' : 'Live-labelled, unverified'} form category ${signal.category.replaceAll('_',' ')} for ${signal.placeName}; relationship ${signal.relation}; observed ${signal.observedAt}. ${grounding.gap} Origin is unverified. A selected form category does not establish an affirmative narrative claim.`, null, signal.observedAt);
    if(reading) {
      cite('interpretation',reading.id,`${signal.placeName} · report text interpretation`,
        `Report version ${signal.id}; text SHA-256 ${reading.textSha256}. ${interpretationStatement(reading)}`,null,signal.observedAt);
      citations.at(-1)!.supportVisibility=reading.visibility==='private' || !reading.exampleId?'private':'public_example';
    }
    const spatial=roadsIndex.match(signal);
    if(spatial.status!=='not_access_report') {
      const supported=!reading || reading.status==='accepted' && reading.claims.some(claim=>['road_blockage','road_condition','access_restriction'].includes(claim.category) && claim.assertion!=='denied');
      const spatialId=cite('map',`spatial:${signal.id}:${roadsIndex.revision}`,`${signal.placeName} · mapped road candidates`,
        `Road location status: ${spatial.status}. ${spatial.gap} ${supported?'':'No accepted non-denied narrative access claim supports publishing candidate geometry. '}`+
        `Displayed source segment references: ${spatial.candidates.map(candidate=>`${candidate.id} (${candidate.roadId}, ${candidate.distanceM} m from rounded reference, ${candidate.lengthM} m segment length)`).join('; ') || 'none'}. Form mode: ${signal.mode}. No candidate establishes passability, a verified blockage or an approved route.`,
        spatial.candidates[0]?.sourceUrl ?? null,signal.observedAt);
      if(supported)for(const candidate of spatial.candidates){const feature=roadsIndex.feature(candidate,signal.id,spatialId);feature.properties!['mode']=signal.mode;roadCandidates.push(feature);}
      if(supported)accessReferences.push({signalId:signal.id,evidenceId:spatialId,candidateRoadIds:[...new Set(spatial.candidates.map(candidate=>candidate.roadId))],gap:spatial.gap});
      if(spatial.status!=='candidate' || !supported)missing.push(`${signal.id}: ${supported?spatial.gap:'Narrative support is absent or explicitly denies the access claim; mapped candidate geometry is withheld.'}`);
    }
    if (['road_blockage','access_restriction'].includes(signal.category)) {
      const textSupportsAccess=!reading || reading.status==='accepted' && reading.claims.some(claim=>['road_blockage','access_restriction'].includes(claim.category) && claim.assertion!=='denied');
      if(!textSupportsAccess)missing.push(`${signal.id}: form category indicates access constraints, but no accepted affirmative or uncertain text claim supports it. The record is excluded from the blockage point layer; this does not establish road clearance.`);
      else if (grounding.status === 'reported_gps' && grounding.location) blockages.push({ type:'Feature',id:signal.id,
        geometry:{type:'Point',coordinates:[grounding.location.lng,grounding.location.lat]},properties:{name:`${signal.placeName} reported access constraint`,status:'reported_unverified',mode:signal.mode,evidence_id:id,precision:'rounded_approximately_100m',road_segment:'unconfirmed'} });
      else missing.push(`${signal.id}: reported ${signal.category.replaceAll('_',' ')} has no usable incident coordinate; it is excluded from the blockage point layer.`);
    }
    for (const place of grounding.candidates) if (!candidates.some(feature => feature.id === place.id)) candidates.push({ type:'Feature',id:place.id,
      geometry:{type:'Point',coordinates:[place.lng,place.lat]},properties:{name:place.name,status:'verification_candidate_not_delivery_zone',ambiguous:grounding.status === 'ambiguous',evidence_id:id} });
  }
  if(interpretations.length) {
    const accepted=interpretations.filter(item=>item.status==='accepted'),claims=accepted.flatMap(item=>item.claims);
    cite('inventory',`interpretation-inventory:${evidence.revision}`,'Generated report-text interpretation inventory',JSON.stringify({reportTextInterpretation:{
      reports:snapshot.count,readings:interpretations.length,accepted:accepted.length,claims:claims.length,verifiedIncidentClaims:0,
      emptyNoObservation:accepted.filter(item=>item.noClaimReason==='no_observation').length,notUnderstood:accepted.filter(item=>item.noClaimReason==='not_understood').length,
      privateReadings:interpretations.filter(item=>item.visibility==='private').length,
      byAssertion:Object.fromEntries(['reported','denied','uncertain','example'].map(kind=>[kind,claims.filter(claim=>claim.assertion===kind).length])),
      basis:'Deterministic aggregation of versioned local readings; claims and copies are not independent incidents or verified field facts.'}}),null,evidence.fetchedAt);
  }
  const gaps = [...new Set([
    ...(evidence.publicEvidence?[evidence.publicEvidence.gap]:['No public-source snapshot is attached to this investigation.']),
    ...(interpretations.length?[`Report text interpretation: ${interpretations.filter(item=>item.status==='accepted').length} accepted source-span checks; ${interpretations.filter(item=>item.status!=='accepted').length} held, failed or budget-limited readings; ${interpretations.filter(item=>item.noClaimReason==='not_understood').length} empty readings require manual interpretation. Private report text is processed only with authorization bound to the project and configured provider. Private quotes and place/time mentions are withheld from shared outputs. A checked quote is not semantic or field verification; text denial/absence of an incident never certifies a road open.`]:[]),
    'Facility capacity, operating hours, services and current availability require direct confirmation; mapped health features are not an exhaustive hospital inventory.',
    'Current road passability, exact incident locations and affected road segments are unverified. No road is certified open or impassable by this map.',
    `Location handling: ${blockages.length} reported access observations have submitted coordinate references and are retained in the reported-access layer; ${snapshot.records.filter(({signal})=>['road_blockage','access_restriction'].includes(signal.category)).length-blockages.length} other access records lack usable coordinates or accepted narrative support and are excluded. Retained points remain unverified, may be demonstrations and do not establish actual incident locations. Exclusion never establishes road clearance.`,
    'No surveyed intervention boundaries or approved delivery zones were supplied; the intervention_zones polygon layer is intentionally empty.',
    evidence.requirements?'Recorded mission inputs and resource statements require operator review; remaining missing fields and feasibility results are listed separately.':'Cargo quantities, beneficiary requirements, dispatch resources, deadlines and an authorized operator decision must be supplied before executable delivery planning.',
    ...(evidence.demoCount ? ['Demonstration reports cannot corroborate an actual incident.'] : []),
    ...(evidence.rows.some(row => row.logisticsSimulated) ? ['Registered stock and fleet are synthetic; their values do not establish actual NGO resources.'] : []),
    ...(evidence.rows.some(row => row.stockUnits !== null && !row.stockFresh || row.fleetCount !== null && !row.fleetFresh) ? ['Registered resource observations have expired and require a current warehouse/fleet confirmation.'] : []),
    ...(snapshot.records.some(record => map.resolve(record.signal).status === 'ambiguous') ? ['Duplicate settlement names retain multiple coordinate candidates; local clarification is required.'] : []),
    ...missing,
  ])];
  cite('query',evidence.revision,'Independently queryable community/resource context',JSON.stringify({ reports:evidence.reportCount,demonstration:evidence.demoCount,liveLabelled:evidence.liveCount,forwarded:evidence.forwardedCount,communities:evidence.rows,queries:evidence.queries.map(query=>({id:query.id,name:query.name,rows:query.rowCount})) }),null,evidence.fetchedAt);
  cite('query',`gaps-${evidence.revision}`,'Required evidence gaps',gaps.join(' '),null,evidence.fetchedAt);
  const planning=evidence.requirements?missionFeasibility(evidence.requirements,map):undefined;
  if(planning) {
    if(planning.route?.status==='mapped_candidate') {
      const routeIds=new Set(planning.route.roadIds);
      planning.accessRelationships=accessReferences.map(item=>({...item,overlappingRoadIds:item.candidateRoadIds.filter(id=>routeIds.has(id)),relationship:!item.candidateRoadIds.length?'unlocated':item.candidateRoadIds.some(id=>routeIds.has(id))?'possible_route_overlap':'no_displayed_overlap'}));
      const possible=[...new Set(planning.accessRelationships.flatMap(item=>item.overlappingRoadIds))];
      if(possible.length) {
        planning.checks.push({code:'REPORTED_ACCESS_OVERLAP',status:'unknown',message:`${possible.length} mapped road references on the candidate route also appear among unverified report-location candidates. Resolve the listed report/road relationships before using the route.`,fields:['origin','destination']});
        planning.alternativeRoute=mappedRouter(map).route(evidence.requirements!.values.origin!,evidence.requirements!.values.destination!,possible);
        planning.limitations.push('The alternative route is a geometric exclusion scenario for possible report overlaps, not a verified safe bypass. No displayed overlap and an empty candidate layer are not clearance.');
      }
      for(const feature of roadCandidates)feature.properties!['possible_route_overlap']=routeIds.has(String(feature.properties!['road_id']));
    }
    const {geometry:_geometry,sourceUrls:_urls,...routeFacts}=planning.route ?? {};
    const {geometry:_alternativeGeometry,sourceUrls:_alternativeUrls,...alternativeFacts}=planning.alternativeRoute ?? {};
    cite('calculation',planning.id,'Deterministic mission feasibility and mapped route',JSON.stringify({...planning,route:planning.route?routeFacts:null,alternativeRoute:planning.alternativeRoute?alternativeFacts:undefined}),null,planning.checkedAt);
    if(planning.missing.length)gaps.push(`Mission requirements still needed: ${planning.missing.map(item=>item.label).join('; ')}.`);
    gaps.push(...planning.checks.filter(check=>check.status!=='pass').map(check=>check.message),...planning.limitations);
  }
  const route=planning?.route?mappedRouter(map).feature(planning.route):null;
  if(route)route.properties!['evidence_id']=citations.find(c=>c.kind==='calculation')!.id;
  const alternative=planning?.alternativeRoute?mappedRouter(map).feature(planning.alternativeRoute):null;
  if(alternative){alternative.properties!['evidence_id']=citations.find(c=>c.kind==='calculation')!.id;alternative.properties!['status']='exclusion_scenario_unverified';}
  const roads = map.layers['roads']!.features.filter(feature => ['LineString','MultiLineString'].includes(feature.geometry.type))
    .map(feature => ({ ...feature, properties: { ...feature.properties, passability:'unknown',evidence_id:mapId } }));
  const layers = { roads:collection(roads),road_candidates:collection(roadCandidates),mission_route:collection([...(route?[route]:[]),...(alternative?[alternative]:[])]),facilities:collection(facilities),blockages:collection(blockages),intervention_zones:collection([]),
    intervention_candidates:collection(candidates),places:map.layers['places']!,facility_footprints:collection(map.layers['facilities']!.features.filter(feature=>feature.geometry.type !== 'Point')) };
  cite('map',`layers-${evidence.revision}`,'Generated evidence layer inventory',
    `Generated layer feature counts: ${JSON.stringify(Object.fromEntries(Object.entries(layers).map(([name,layer])=>[name,layer.features.length])))}. Blockage features are reported/unverified access observations, including demonstrations; they are not independently confirmed incidents. Intervention candidates are community references, not surveyed delivery zones.`,null,evidence.fetchedAt);
  return {runId,objective,capturedAt:new Date().toISOString(),revision:evidence.revision,citations,...(planning?{planning}:{}),
    modelEvidence:citations.filter(item=>!['report','interpretation'].includes(item.kind)).concat(citations.filter(item=>item.kind==='report').slice(0,12),citations.filter(item=>item.kind==='interpretation').slice(0,12)).map(({id,kind,title,statement})=>({id,kind,title,
      statement:statement.replace(/reference longitude [-\d.]+, latitude [-\d.]+; /g,'').replace(/ at longitude [-\d.]+, latitude [-\d.]+/g,' at the mapped source reference').replace(/ Bounds \[[^\]]+\] in EPSG:4326\./g,' Geographic coordinates are retained in the generated source inventory.')})),gaps,layers,
    bounds:map.manifest.bounds,attribution:map.manifest.attribution,mapVersion:map.manifest.version,...(update?{update}:{})};
}

export function validateCitedMarkdown(markdown: string, citations: EvidenceCitation[]) {
  if (markdown.length < 180) throw new Error('Document is too short to be a complete reviewable artifact.');
  const filler=markdown.match(/\b(TBD|lorem ipsum|insert here|placeholder)\b/i);
  if(filler)throw new Error(`Remove the filler marker "${filler[0]}" from the document, including when discussing its absence. State the actual evidence gap directly.`);
  if(/\b\d{1,3}\.\d{4,}\b/.test(markdown))throw new Error('Remove numerical geographic coordinates from narrative prose; the exact inventories are generated directly from source geometry.');
  const supportedDates=new Set(citations.flatMap(citation=>calendarDays(citation.statement)));
  if(calendarDays(markdown).some(date=>!supportedDates.has(date)))throw new Error('Remove unsupported calendar dates; obtain missing deadlines from the operator.');
  const known = new Set(citations.map(citation=>citation.id));
  const cited = [...markdown.matchAll(/\[(E[a-f0-9]{10})\]/g)].map(match=>match[1]!);
  const unknown=[...new Set(cited.filter(id=>!known.has(id)))];
  if (!cited.length || unknown.length) throw new Error(`Document contains missing or unknown evidence references.${unknown.length?` Unknown IDs: ${unknown.join(', ')}.`:''}`);
  const paragraphs = markdown.split(/\n\s*\n/).map(block=>block.replace(/^\s*#{1,6}\s.*$/gm,'').trim()).filter(Boolean);
  const inventory=citations.find(item=>item.kind==='inventory' && item.recordId.startsWith('interpretation-inventory:'));
  if(inventory) {
    const counts=JSON.parse(inventory.statement).reportTextInterpretation;
    const expected=counts.claims as number;
    const words=['zero','one','two','three','four','five','six','seven','eight','nine','ten'];
    for(const block of paragraphs)for(const match of block.matchAll(/\b(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:(?:source[- ]checked|extracted|interpreted|text|operational)\s+){0,3}claims\b/gi)) {
      const actual=/^\d+$/.test(match[1]!)?Number(match[1]):words.indexOf(match[1]!.toLowerCase());
      const suffix=block.slice(match.index!+match[0].length);
      const verifiedQualifier=actual===0 && counts.verifiedIncidentClaims===0 && /^(?:\s*\[E[a-f0-9]{10}\])*\s+(?:confirming|corroborating|verifying|establishing)(?:\s+any)?\s+(?:actual|real)(?:\s+field)?\s+incidents\b/i.test(suffix);
      if(actual!==expected && !verifiedQualifier)throw new Error(`Text-claim aggregate does not match the generated interpretation inventory (${expected}). Do not generalize one report's count or write per-report numeric claim totals in narrative.`);
      if(!block.includes(`[${inventory.id}]`))throw new Error('Numeric text-claim totals must cite the generated interpretation inventory.');
    }
  }
  const questionOnly=(block:string)=>block.split('\n').filter(line=>line.trim()).every(line=>/^\s*(?:[-*]|\d+[.)])?\s*(?:what|which|who|when|where|how|is|are|can|does|do)\b.*\?\s*$/i.test(line));
  const verdictOnly=(block:string)=>/^\*\*Verdict:\s*(REVISE|ACCEPT_WITH_GAPS)\*\*$/.test(block);
  const noChangesOnly=(block:string)=>/^(?:[-*]\s*)?None[.!]?$/.test(block);
  const uncited=paragraphs.flatMap((block,index)=>!(/\[E[a-f0-9]{10}\]/.test(block)) && !questionOnly(block) && !verdictOnly(block) && !noChangesOnly(block)?[index+1]:[]);
  if (uncited.length) throw new Error(`Factual document blocks ${uncited.join(', ')} have no evidence reference.`);
  if (/<\/?(?:script|iframe|think)\b/i.test(markdown)) throw new Error('Document contains disallowed markup.');
  return [...new Set(cited)];
}
