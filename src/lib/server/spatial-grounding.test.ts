// @vitest-environment node
import { CommunityMap } from './community-map';
import { RoadIndex } from './spatial-grounding';
import { normalizeKobo } from './kobo';
const signal = (changes: Record<string, unknown> = {}) => normalizeKobo({ _id: 1, _uuid: 'road-example', report_mode: 'demo', observed_at: '2026-10-26T08:00:00Z',
  place_name: 'Bambili', category: 'road_blockage', report_text: 'A demonstration access report.', source_relation: 'reported', ...changes }, 'exampleproject', '2026-10-26T08:01:00Z').signal;
function map(lines: number[][][]) {
  const source = new CommunityMap();
  source.layers['roads'] = { type: 'FeatureCollection', features: lines.map((coordinates, i) => ({ type: 'Feature', id: `road-${i}`, properties: { id: `way/${i}`, evidenceId: `road-${i}`, highway: 'residential' }, geometry: { type: 'LineString', coordinates } })) };
  return source;
}
it('does not snap a settlement label, a non-access report or an outside-coverage point', () => {
  const index = new RoadIndex(map([[[10.2, 6], [10.21, 6]]]));
  expect(index.match(signal())).toMatchObject({ status: 'unlocated', candidates: [] });
  expect(index.match(signal({ category: 'service_status' }))).toMatchObject({ status: 'not_access_report' });
  expect(index.match(signal({ location: '7 11 0 10' }))).toMatchObject({ status: 'unlocated' });
});
it('uses acquired Turf geometry and preserves multiple nearby segments as alternatives', () => {
  const index = new RoadIndex(map([[[10.19, 6], [10.21, 6]], [[10.19, 6.001], [10.21, 6.001]]]));
  const result = index.match(signal({ location: '6.00049 10.20049 0 20' }));
  expect(result).toMatchObject({ status: 'ambiguous', totalCandidates: 2, searchRadiusM: 250 });
  expect(result.candidates[0]?.distanceM).toBeLessThan(2); // rounded reference, not raw GPS
  expect(result.candidates[1]?.distanceM).toBeGreaterThan(100);
  expect(index.feature(result.candidates[0]!, 'signal-one', 'E123')).toMatchObject({ properties: { passability: 'unknown', status: 'possible_affected_segment_unverified' } });
  expect(result.candidates[0]?.lengthM).toBeGreaterThan(2_000);
});
it('a unique map candidate still requires verification and never means a confirmed blockage', () => {
  const result = new RoadIndex(map([[[10.19, 6], [10.21, 6]]])).match(signal({ location: '6 10.2 0 20' }));
  expect(result.status).toBe('candidate'); expect(result.gap).toContain('not verified affected roads');
});
it('reports an empty search and broad accuracy as gaps, and makes truncation explicit', () => {
  const index = new RoadIndex(map(Array.from({ length: 20 }, (_, i) => [[10.19, 6 + i / 100_000], [10.21, 6 + i / 100_000]])));
  expect(index.match(signal({ location: '6.08 10.2 0 20' }))).toMatchObject({ status: 'no_candidate', totalCandidates: 0 });
  expect(index.match(signal({ location: '6 10.2 0 1000' }))).toMatchObject({ status: 'unlocated' });
  expect(index.match(signal({ location: '6 10.2 0 20' }))).toMatchObject({ status: 'ambiguous', totalCandidates: 20, truncated: true, candidates: expect.any(Array) });
  expect(index.match(signal({ location: '6 10.2 0 20' })).candidates).toHaveLength(12);
});
