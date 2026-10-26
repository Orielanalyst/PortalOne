import createGraph from 'ngraph.graph';
import { aStar } from 'ngraph.path';
import length from '@turf/length';
import type { Feature, LineString, Position } from 'geojson';
import type { CommunityMap } from './community-map';
import { createHash } from 'node:crypto';

type RoadLink = { roadId: string; geometry: LineString; lengthM: number; sourceUrl: string };
type RouteNode = { coordinates: Position };
export type MappedRoute = { id: string; status: 'mapped_candidate' | 'unresolved'; from: string; to: string;
  distanceKm: number | null; originOffsetM: number | null; destinationOffsetM: number | null;
  roadIds: string[]; geometry: LineString | null; avoidedRoadIds: string[]; gaps: string[]; sourceUrls: string[] };
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const motorRoad = /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street|track|road)(?:_link)?$/;
const distanceM = (a: Position, b: Position) => length({ type: 'Feature', geometry: { type: 'LineString', coordinates: [a, b] }, properties: {} }, { units: 'meters' });

/** Acquired Dijkstra/A* implementation over existing source vertices, never a model-drawn route. */
export class MappedRouter {
  private readonly graph = createGraph<RouteNode, RoadLink>({ multigraph: true });
  private readonly nodes: { id: string; coordinates: Position }[] = [];
  private readonly revision: string;
  constructor(private readonly map: CommunityMap) {
    this.revision = digest(map.manifest);
    const node = (coordinates: Position) => {
      const id = coordinates.slice(0, 2).join(',');
      if (!this.graph.getNode(id)) { this.graph.addNode(id, { coordinates }); this.nodes.push({ id, coordinates }); }
      return id;
    };
    for (const feature of map.layers['roads']!.features) {
      if (!motorRoad.test(String(feature.properties?.['highway'])) || ['no', 'private'].includes(String(feature.properties?.['access']))) continue;
      const parts = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.type === 'MultiLineString' ? feature.geometry.coordinates : [];
      for (const coordinates of parts) for (let i = 0; i < coordinates.length - 1; i++) {
        const a = coordinates[i]!, b = coordinates[i + 1]!; if (a[0] === b[0] && a[1] === b[1]) continue;
        const from = node(a), to = node(b), direction = String(feature.properties?.['oneway']);
        const data: RoadLink = { roadId: String(feature.properties?.['evidenceId'] ?? feature.id), geometry: { type: 'LineString', coordinates: [a, b] },
          lengthM: distanceM(a, b), sourceUrl: `https://www.openstreetmap.org/${String(feature.properties?.['id'])}` };
        if (direction !== '-1') this.graph.addLink(from, to, data);
        if (!['yes', '1', 'true'].includes(direction)) this.graph.addLink(to, from, data);
      }
    }
  }
  private place(name: string) {
    const normalized = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const candidates=this.map.places.map(place=>({id:place.id,name:place.name,coordinates:[place.lng,place.lat]}));
    const firstPoint=(value:unknown):Position|null=>{if(!Array.isArray(value))return null;if(typeof value[0]==='number' && typeof value[1]==='number')return value as Position;return firstPoint(value[0]);};
    for(const feature of this.map.layers['facilities']!.features){const xy=firstPoint('coordinates' in feature.geometry?feature.geometry.coordinates:null);if(xy && feature.properties?.['name'])candidates.push({id:String(feature.properties['evidenceId'] ?? feature.id),name:String(feature.properties['name']),coordinates:xy});}
    const matches=candidates.filter(place=>normalized(place.name)===normalized(name) || place.id===name);
    return matches.length===1?{id:matches[0]!.id,coordinates:matches[0]!.coordinates}:null;
  }
  route(from: string, to: string, avoidRoadIds: string[] = []): MappedRoute {
    const base = { from, to, avoidedRoadIds: [...new Set(avoidRoadIds)].sort(), roadIds: [] as string[], geometry: null,
      distanceKm: null, originOffsetM: null, destinationOffsetM: null, sourceUrls: [] as string[] };
    const unresolved = (gap: string): MappedRoute => ({ ...base, id: `route-${digest([this.revision, from, to, avoidRoadIds, gap]).slice(0, 24)}`, status: 'unresolved', gaps: [gap] });
    const origin = this.place(from), destination = this.place(to);
    if (!origin || !destination) return unresolved('Origin or destination has no unique acquired map reference. Clarify the place instead of inventing a warehouse or delivery entrance.');
    if (origin.id === destination.id) return unresolved('Origin and destination resolve to the same community reference; specify distinct delivery endpoints.');
    const nearest = (xy: Position) => this.nodes.map(n => ({ ...n, distanceM: distanceM(xy, n.coordinates) })).sort((a, b) => a.distanceM - b.distanceM || a.id.localeCompare(b.id))[0];
    const start = nearest(origin.coordinates), end = nearest(destination.coordinates);
    if (!start || !end || start.distanceM > 500 || end.distanceM > 500) return unresolved('A mapped endpoint is more than 500 metres from the acquired motor-road graph. Last-mile access and the actual entrance need confirmation.');
    const avoid = new Set(avoidRoadIds);
    const finder = aStar(this.graph, { oriented: true, heuristic: () => 0, distance: (_a, _b, link) => link.data.lengthM,
      blocked: (_a, _b, link) => avoid.has(link.data.roadId) });
    // Native smoke confirms ngraph returns target -> origin.
    const path = finder.find(start.id, end.id).reverse();
    if (path.length < 2) return unresolved('No connected mapped motor-road path exists for these endpoints and exclusions. The acquired extract may be incomplete; no detour is fabricated.');
    let meters = 0; const links: RoadLink[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]!, b = path[i + 1]!;
      const matching = [...(a.links ?? [])].filter(link => link.fromId === a.id && link.toId === b.id && !avoid.has((link.data as RoadLink).roadId))
        .map(link => link.data as RoadLink).sort((x, y) => x.lengthM - y.lengthM || x.roadId.localeCompare(y.roadId))[0];
      if (!matching) throw new Error('Mapped path lost its source edge.');
      links.push(matching); meters += matching.lengthM;
    }
    const geometry: LineString = { type: 'LineString', coordinates: path.map(n => n.data.coordinates) };
    return { ...base, id: `route-${digest([this.revision, geometry, avoidRoadIds]).slice(0, 24)}`, status: 'mapped_candidate',
      geometry, roadIds: [...new Set(links.map(l => l.roadId))], distanceKm: Math.round(meters) / 1000,
      originOffsetM: Math.round(start.distanceM), destinationOffsetM: Math.round(end.distanceM), sourceUrls: [...new Set(links.map(l => l.sourceUrl))],
      gaps: ['This is a geometric candidate through source vertices, not a surveyed, passable or approved delivery route. Grade-separated connectivity, access permissions, bridge/gross-weight limits, surface suitability and present road conditions need confirmation.',
        'Endpoints are mapped community/facility references, not verified warehouses, unloading points or vehicle entrances. Polygon-derived facility references use a source boundary vertex. The calculation excludes unsurveyed endpoint offsets; those must be resolved before travel.'] };
  }
  feature(route: MappedRoute): Feature<LineString> | null {
    return route.geometry ? { type: 'Feature', id: route.id, geometry: route.geometry,
      properties: { name: `${route.from} to ${route.to}`, status: 'mapped_route_candidate_unverified', distance_km: route.distanceKm,
        road_ids: route.roadIds.join(';'), passability: 'unknown' } } : null;
  }
}
