// @vitest-environment node
import { applyMissionPatch, missingMissionInputs, publicRequirements,normalizeMissionTime } from './mission-requirements';
it('retains exact user provenance and collects a mission incrementally without inventing missing values', () => {
  const first = applyMissionPatch(null, { origin: { value: 'Bamenda', support: 'from Bamenda' }, quantity: { value: 120, support: '120 kits' } }, ['Deliver 120 kits from Bamenda'], 'turn-one');
  const next = applyMissionPatch(first, { destination: { value: 'Bambili', support: 'to Bambili' } }, ['Go to Bambili'], 'turn-two');
  expect(next.version).toBe(2); expect(next.values).toEqual({ origin: 'Bamenda', quantity: 120, destination: 'Bambili' });
  expect(missingMissionInputs(next)).toContain('deadline');
  expect(publicRequirements(next)).not.toHaveProperty('sources');
  expect(JSON.stringify(publicRequirements(next))).not.toContain('120 kits');
});
it('normalizes natural dates against the original user message in the declared Cameroon timezone',()=>{
  const source={text:'Depart tomorrow at 9am',at:'2026-10-26T08:00:00Z',turnId:'original-turn'};
  const profile=applyMissionPatch(null,{departAt:{value:'tomorrow at 9am',support:'Depart tomorrow at 9am'}},[source],'later-turn');
  expect(profile.values.departAt).toBe('2026-10-27T08:00:00.000Z');expect(profile.sources.departAt?.turnId).toBe('original-turn');
  expect(normalizeMissionTime('demain à 9h',source.at)).toBe('2026-10-27T08:00:00.000Z');
  expect(normalizeMissionTime('now',source.at)).toBe('2026-10-26T08:00:00.000Z');
  expect(()=>normalizeMissionTime('tomorrow morning',source.at)).toThrow('explicit');
  expect(()=>normalizeMissionTime('9am',source.at)).toThrow('explicit');
});
it('rejects invented numbers, source quotations and unstated mode', () => {
  expect(() => applyMissionPatch(null, { quantity: { value: 1000, support: '100 kits' } }, ['100 kits'], 't')).toThrow('number');
  expect(() => applyMissionPatch(null, { origin: { value: 'Bambili', support: 'Bambili' } }, ['Bamenda'], 't')).toThrow('exact');
  expect(() => applyMissionPatch(null, { mode: { value: 'demonstration', support: 'Start planning' } }, ['Start planning'], 't')).toThrow('mode');
  expect(() => applyMissionPatch(null, { fuelLitres: { value: -5, support: '-5 litres' } }, ['-5 litres'], 't')).toThrow();
});
it('normalizes decimal strings without accepting truthy values or dropping exact-source checks',()=>{
  expect(applyMissionPatch(null,{quantity:{value:'80',support:'80 kits'}},['80 kits'],'t').values.quantity).toBe(80);
  expect(()=>applyMissionPatch(null,{quantity:{value:true,support:'1 kit'}},['1 kit'],'t')).toThrow();
  expect(()=>applyMissionPatch(null,{quantity:{value:'800',support:'80 kits'}},['80 kits'],'t')).toThrow('number');
});
it('requires explicit timezone timestamps and prevents unsupported boolean/clearing changes', () => {
  expect(() => applyMissionPatch(null, { departAt: { value: '2026-10-27T08:00:00', support: '2026-10-27T08:00:00' } }, ['2026-10-27T08:00:00'], 't')).toThrow();
  expect(() => applyMissionPatch(null, { vehicleAvailable: { value: true, support: 'not available' } }, ['not available'], 't')).toThrow('boolean');
  expect(() => applyMissionPatch(null, { quantity: { value: null, support: 'hello' } }, ['hello'], 't')).toThrow('Clearing');
});
it('repeated values do not manufacture versions; explicit correction does invalidate the input revision', () => {
  const first = applyMissionPatch(null, { quantity: { value: 100, support: '100 kits' } }, ['100 kits'], 't');
  expect(applyMissionPatch(first, { quantity: { value: 100, support: '100 kits' } }, ['100 kits'], 't2')).toBe(first);
  const changed = applyMissionPatch(first, { quantity: { value: 200, support: '200 kits' } }, ['200 kits'], 't3');
  expect(changed.revision).not.toBe(first.revision);
  expect(applyMissionPatch(changed, { quantity: { value: null, support: 'quantity unknown' } }, ['quantity unknown'], 't4').values.quantity).toBeUndefined();
});
