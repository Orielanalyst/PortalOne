// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ReliefWorld, type ReliefObservation } from './relief-world';

const base: ReliefObservation = {
  id: 'signal-1', originId: 'witness-1', sourceId: 'synthetic-driver', sourceKind: 'file',
  segmentId: 'mile4-bambili', claim: 'passable', observedAt: '2026-10-24T08:00:00Z',
  expiresAt: '2026-10-24T10:00:00Z', forwarded: false, simulated: true,
};
const now = '2026-10-24T09:00:00Z';

it('deduplicates concurrent replay and preserves immutable observation provenance', async () => {
  const world = new ReliefWorld({ namespace: 'replay' });
  expect(await Promise.all([world.capture(base), world.capture(base)]))
    .toEqual([{ changed: true }, { changed: false }]);
  expect(world.audit()).toHaveLength(1);
  await expect(world.capture({ ...base, claim: 'blocked' })).rejects.toThrow();
});

it('counts independent origins instead of forwarded-message volume', async () => {
  const world = new ReliefWorld({ namespace: 'origins' });
  await world.capture(base);
  await world.recordPlan({ id: 'plan-before-forwards', segmentIds: [base.segmentId] }, now);
  await world.capture({ ...base, id: 'forward-1', sourceId: 'social-1', forwarded: true });
  await world.capture({ ...base, id: 'forward-2', sourceId: 'social-2', forwarded: true });
  expect(world.assess(base.segmentId, now)).toMatchObject({ independentOrigins: 1,
    evidenceIds: ['signal-1'], status: 'reported_passable' });
  expect((await world.reviewPlan('plan-before-forwards', now)).status).toBe('proposed');
});

it('preserves contradictory claims and invalidates only affected plans', async () => {
  const world = new ReliefWorld({ namespace: 'contradiction' });
  await world.capture(base);
  await world.recordPlan({ id: 'plan-1', segmentIds: [base.segmentId] }, now);
  await world.capture({ ...base, id: 'elsewhere', originId: 'other', segmentId: 'unrelated-road', claim: 'blocked' });
  expect((await world.reviewPlan('plan-1', now)).status).toBe('proposed');
  await world.capture({ ...base, id: 'signal-2', originId: 'witness-2', claim: 'blocked',
    observedAt: '2026-10-24T09:01:00Z' });
  expect(world.assess(base.segmentId, '2026-10-24T09:02:00Z').status).toBe('disputed');
  expect(await world.reviewPlan('plan-1', '2026-10-24T09:02:00Z')).toMatchObject({
    status: 'invalidated', reason: expect.stringContaining('reported_passable -> disputed'),
  });
});

it('expires claims into unknown and invalidates the previous assumption', async () => {
  const world = new ReliefWorld({ namespace: 'expiry' });
  await world.capture(base);
  await world.recordPlan({ id: 'plan-1', segmentIds: [base.segmentId] }, now);
  expect(world.assess(base.segmentId, base.expiresAt).status).toBe('unknown');
  expect((await world.reviewPlan('plan-1', base.expiresAt)).status).toBe('invalidated');
});

it('does not resurrect older claims when a newer one expires', async () => {
  const world = new ReliefWorld({ namespace: 'no-resurrection' });
  await world.capture({ ...base, expiresAt: '2026-10-24T12:00:00Z' });
  await world.capture({ ...base, id: 'correction', claim: 'blocked',
    observedAt: '2026-10-24T09:00:00Z', expiresAt: '2026-10-24T10:00:00Z' });
  expect(world.assess(base.segmentId, '2026-10-24T10:01:00Z').status).toBe('unknown');
});

it('reloads observations and invalidated plans from the durable engine store', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'portal-world-'));
  try {
    const world = new ReliefWorld({ namespace: 'durable', directory });
    await world.capture(base);
    await world.recordPlan({ id: 'plan-1', segmentIds: [base.segmentId] }, now);
    await world.reviewPlan('plan-1', base.expiresAt);
    const restored = new ReliefWorld({ namespace: 'durable', directory });
    expect((await restored.reviewPlan('plan-1', base.expiresAt)).status).toBe('invalidated');
    expect(await restored.capture(base)).toEqual({ changed: false });
    expect(restored.audit().length).toBeGreaterThan(1);
  } finally {
    if (dirname(resolve(directory)) !== resolve(tmpdir())) throw new Error('Unexpected temporary test path.');
    rmSync(directory, { recursive: true, force: true });
  }
});

it('rejects missing timezone, invalid expiry and namespace traversal', async () => {
  expect(() => new ReliefWorld({ namespace: '../outside' })).toThrow('namespace');
  const world = new ReliefWorld({ namespace: 'validation' });
  await expect(world.capture({ ...base, observedAt: '2026-10-24T08:00:00' })).rejects.toThrow('timezone');
  await expect(world.capture({ ...base, expiresAt: base.observedAt })).rejects.toThrow('expiry');
});
