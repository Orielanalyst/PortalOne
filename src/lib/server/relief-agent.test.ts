// @vitest-environment node
import { FixtureReliefSource, readScenario } from './relief-source';
import { runRelief } from './relief-agent';
import { EnumerationReliefPlanner } from './relief-planner';
import type { ReliefPlanner } from './relief-planner';
import { ReliefWorld } from './relief-world';
import { validateRelief } from './relief-validator';

const pack = readScenario();
const source = new FixtureReliefSource();
const planner = new EnumerationReliefPlanner();
const world = () => new ReliefWorld({ namespace: 'test-relief-agent' });
const heavy = { routeId: 'sim-direct', vehicleId: 'sim-heavy-truck', rationale: 'Synthetic adversarial input.' };

it('rejects gross mass, revises to a valid vehicle and stops for operator review', async () => {
  const result = await runRelief({ mission: pack.mission, asOf: pack.clock, source, planner, world: world(), initialDraft: heavy });
  expect(result.disposition).toBe('operator_review');
  expect(result.events.find(e => e.kind === 'rejected')?.detail).toContain('5800 kg');
  expect(result.proposal?.vehicleId).toBe('sim-light-truck');
  expect(result.validation?.calculations).toMatchObject({ cargoKg: 1000, grossKg: 3100, requiredFuelLitres: 20 });
  expect(result.trackedPlan?.status).toBe('proposed');
  expect(result.models).toHaveLength(0);
});

it('invalidates an affected plan on a contradictory report and replans to the detour', async () => {
  const state = world();
  const first = await runRelief({ mission: pack.mission, asOf: pack.clock, source, planner, world: state });
  const changed = await source.load(pack.mission, pack.changedAt);
  for (const observation of changed.observations) await state.capture(observation);
  expect((await state.reviewPlan(first.trackedPlan!.id, pack.changedAt)).status).toBe('invalidated');
  const next = await runRelief({ mission: pack.mission, asOf: pack.changedAt, source, planner, world: state });
  expect(next.disposition).toBe('operator_review');
  expect(next.proposal?.routeId).toBe('sim-detour');
});

it('holds an impossible deadline and all expired-report cases', async () => {
  const impossible = await runRelief({ mission: { ...pack.mission, deadline: '2026-10-24T09:45:00Z' },
    asOf: pack.clock, source, planner, world: world() });
  expect(impossible.disposition).toBe('hold');
  const expired = await runRelief({ mission: { ...pack.mission, deadline: '2026-10-24T13:00:00Z' },
    asOf: '2026-10-24T11:01:00Z', source, planner, world: world() });
  expect(expired.disposition).toBe('hold');
});

it('the validator fetches independently and rejects evidence that changed after planning', async () => {
  let loads = 0;
  const changingSource = { load: async (...args: Parameters<FixtureReliefSource['load']>) => {
    loads++;
    const snapshot = await source.load(...args);
    if (loads > 1) snapshot.observations = []; // Missing evidence is never a pass.
    return snapshot;
  } };
  const result = await runRelief({ mission: pack.mission, asOf: pack.clock, source: changingSource, planner,
    world: world(), limits: { maxRevisions: 0 } });
  expect(loads).toBe(2);
  expect(result.disposition).toBe('hold');
  expect(result.validation?.violations.some(v => v.code === 'ROAD_REQUIRES_VERIFICATION')).toBe(true);
});

it('caps repeated invented candidates at three drafts and two revisions', async () => {
  const propose = vi.fn(async () => ({ proposal: { routeId: 'invented', vehicleId: 'invented', rationale: 'Bad candidate.' } }));
  const bad: ReliefPlanner = { mode: 'offline-enumeration', propose };
  const result = await runRelief({ mission: pack.mission, asOf: pack.clock, source, planner: bad, world: world() });
  expect(propose).toHaveBeenCalledTimes(3);
  expect(result.disposition).toBe('hold');
  expect(result.reservedQuerySlots).toBe(8);
  expect(result.events.filter(e => e.kind === 'revision')).toHaveLength(2);
});

it('holds when query slots cannot cover independent validation', async () => {
  const result = await runRelief({ mission: pack.mission, asOf: pack.clock, source, planner, world: world(), limits: { maxQueries: 2 } });
  expect(result.disposition).toBe('hold');
  expect(result.trackedPlan).toBeNull();
  expect(result.events.at(-1)?.detail).toContain('query budget');
});

it('a hanging planner cannot outlive the overall run deadline', async () => {
  const hanging: ReliefPlanner = { mode: 'offline-enumeration', propose: () => new Promise(() => {}) };
  const result = await runRelief({ mission: pack.mission, asOf: pack.clock, source, planner: hanging, world: world(), limits: { timeoutMs: 40 } });
  expect(result.disposition).toBe('hold');
  expect(result.durationMs).toBeLessThan(1000);
  expect(result.events.at(-1)?.detail).toContain('deadline');
});

it('requires two independent origins and supporting expiry through delivery', async () => {
  const snapshot = await source.load(pack.mission, pack.clock);
  const candidate = snapshot.candidates.find(c => c.routeId === 'sim-direct' && c.vehicleId === 'sim-light-truck')!;
  snapshot.observations = snapshot.observations.filter(o => o.originId === 'sim-origin-1');
  const oneOrigin = await validateRelief(pack.mission, candidate, snapshot);
  expect(oneOrigin.violations.some(v => v.code === 'INSUFFICIENT_ORIGINS')).toBe(true);
  const fresh = await source.load(pack.mission, pack.clock);
  fresh.observations.forEach(o => { o.expiresAt = '2026-10-24T09:30:00Z'; });
  const expires = await validateRelief(pack.mission, candidate, fresh);
  expect(expires.violations.some(v => v.code === 'EVIDENCE_EXPIRES_BEFORE_DELIVERY')).toBe(true);
});

it('checks the earliest-delivery objective against independently feasible alternatives', async () => {
  const snapshot = await source.load(pack.mission, pack.clock);
  const detour = snapshot.candidates.find(c => c.routeId === 'sim-detour' && c.vehicleId === 'sim-light-truck')!;
  const result = await validateRelief(pack.mission, detour, snapshot);
  expect(result.eligible).toBe(false);
  expect(result.violations[0]?.code).toBe('EARLIER_ELIGIBLE_CANDIDATE');
  expect(result.violations[0]?.message).toContain('20 minutes earlier');
});
