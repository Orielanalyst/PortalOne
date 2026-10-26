// @vitest-environment node
import { CommunityMap } from './community-map';
import { MappedRouter } from './mapped-route';
import { missionFeasibility } from './mission-feasibility';
import type { MissionValues } from './mission-requirements';
const now = '2026-10-26T08:00:00Z';
function map() {
  const value = new CommunityMap();
  value.places.splice(0, value.places.length, { id: 'origin', name: 'Origin', kind: 'town', lat: 6, lng: 10.19 }, { id: 'target', name: 'Target', kind: 'town', lat: 6, lng: 10.21 });
  value.layers['roads'] = { type: 'FeatureCollection', features: [{ type: 'Feature', id: 'road', properties: { evidenceId: 'road', id: 'way/1', highway: 'residential', oneway: 'yes' }, geometry: { type: 'LineString', coordinates: [[10.19, 6], [10.20, 6], [10.21, 6]] } }] };
  return value;
}
const values: MissionValues = { mode: 'demonstration', origin: 'Origin', destination: 'Target', beneficiaries: 200,
  cargoLabel: 'relief kits', quantity: 80, unitMassKg: 5, departAt: '2026-10-26T09:00:00Z', deadline: '2026-10-26T12:00:00Z',
  stockUnits: 100, stockObservedAt: '2026-10-26T07:00:00Z', stockValidUntil: '2026-10-27T12:00:00Z',
  vehicleName: 'Exercise truck', payloadKg: 500, tareKg: 2000, fuelLitres: 40, litresPerKm: 0.2, fourWheelDrive: true, vehicleAvailable: true,
  vehicleObservedAt: '2026-10-26T07:00:00Z', vehicleValidUntil: '2026-10-27T12:00:00Z', planningSpeedKph: 20,
  handlingMinutes: 30, bufferMinutes: 20, fuelReserveLitres: 10 };
it('finds source-linked oriented graph geometry and refuses an excluded or reverse one-way route', () => {
  const router = new MappedRouter(map());
  const route = router.route('Origin', 'Target');
  expect(route).toMatchObject({ status: 'mapped_candidate', roadIds: ['road'], originOffsetM: 0, destinationOffsetM: 0 });
  expect(route.geometry?.coordinates[0]).toEqual([10.19, 6]); expect(route.geometry?.coordinates.at(-1)).toEqual([10.21, 6]);
  expect(route.distanceKm).toBeGreaterThan(2); expect(route.sourceUrls).toEqual(['https://www.openstreetmap.org/way/1']);
  expect(router.route('Target', 'Origin').status).toBe('unresolved');
  expect(router.route('Origin', 'Target', ['road']).status).toBe('unresolved');
  expect(router.route('Unknown', 'Target').status).toBe('unresolved');
});
it('calculates complete operator inputs with the existing round-trip/reserve policy but retains field holds', () => {
  const result = missionFeasibility({ values, revision: 'example-inputs' }, map(), { now });
  expect(result.status).toBe('conditional'); expect(result.dispatchAuthorized).toBe(false);
  expect(result.calculations).toMatchObject({ cargoKg: 400, grossKg: 2400 });
  expect(result.calculations!.requiredFuelLitres).toBeCloseTo(result.route!.distanceKm! * 2 * 0.2 * 1.5 + 10);
  expect(result.checks.filter(check => check.status === 'fail')).toHaveLength(0);
  expect(result.checks).toContainEqual(expect.objectContaining({ code: 'ROAD_FIELD_CONFIRMATION', status: 'unknown' }));
  expect(result.validUntil).toBe(values.deadline);
});
it('does not use expired fixture resources or fill missing mission values', () => {
  const result = missionFeasibility({ values: { origin: 'Origin', destination: 'Target', quantity: 80 }, revision: 'partial' }, map(), { now });
  expect(result.status).toBe('needs_inputs'); expect(result.calculations).toBeNull();
  expect(result.missing.map(v => v.field)).toContain('fuelLitres');
  expect(missionFeasibility(null, map(), { now }).route).toBeNull();
});
it('rejects stock, payload, fuel, freshness and time violations independently of model prose', () => {
  const result = missionFeasibility({ values: { ...values, quantity: 120, fuelLitres: 1, stockValidUntil: '2026-10-26T08:30:00Z',
    deadline: '2026-10-26T09:01:00Z', vehicleObservedAt: '2026-10-26T10:00:00Z' }, revision: 'infeasible' }, map(), { now });
  expect(result.status).toBe('infeasible');
  expect(result.checks.filter(c => c.status === 'fail').map(c => c.code)).toEqual(expect.arrayContaining(['STOCK', 'PAYLOAD', 'FUEL', 'DEADLINE', 'STOCK_FRESHNESS', 'VEHICLE_FRESHNESS']));
});
