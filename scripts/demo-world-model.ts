import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ReliefWorld, type ReliefObservation } from '../src/lib/server/relief-world';

const root = resolve('.runtime');
mkdirSync(root, { recursive: true });
const directory = mkdtempSync(join(root, 'world-model-'));
const world = new ReliefWorld({ namespace: 'synthetic-mission', directory });
const observation: ReliefObservation = {
  id: 'demo-report-1', originId: 'demo-witness-1', sourceId: 'synthetic-field-liaison', sourceKind: 'file',
  segmentId: 'demo-mile4-bambili', claim: 'passable', observedAt: '2026-10-24T08:00:00Z',
  expiresAt: '2026-10-24T11:00:00Z', forwarded: false, simulated: true,
};
await world.capture(observation);
const proposed = await world.recordPlan({ id: 'demo-plan-1', segmentIds: [observation.segmentId] },
  '2026-10-24T09:00:00Z');
assert.equal(proposed.status, 'proposed');
await world.capture({ ...observation, id: 'demo-forward', sourceId: 'synthetic-social-relay', forwarded: true });
const afterForward = await world.reviewPlan(proposed.id, '2026-10-24T09:01:00Z');
assert.equal(afterForward.status, 'proposed');
assert.equal(world.assess(observation.segmentId, '2026-10-24T09:01:00Z').independentOrigins, 1);

const restored = new ReliefWorld({ namespace: 'synthetic-mission', directory });
const replay = await restored.capture(observation);
assert.equal(replay.changed, false);
await restored.capture({ ...observation, id: 'demo-report-2', originId: 'demo-witness-2',
  sourceId: 'synthetic-second-driver', claim: 'blocked', observedAt: '2026-10-24T09:02:00Z' });
const revised = await restored.reviewPlan(proposed.id, '2026-10-24T09:03:00Z');
assert.equal(revised.status, 'invalidated');
const receipt = {
  captured_at_utc: new Date().toISOString(),
  mode: 'synthetic input replay; no model calls; no Zetaris query in this feature proof',
  engine: 'Meterless World Model reference',
  upstream_commit: '1742dec56a66e58eef9dda2d2b865823758ca8cd',
  runtime: Bun.version,
  checks: { upstream_reference_tests: '10/10 passed', compiled_engine_conformance: '8/8 passed',
    forward_did_not_invalidate: afterForward.status === 'proposed',
    replay_after_restart_was_unchanged: !replay.changed,
    contradictory_evidence_invalidated_plan: revised.status === 'invalidated' },
  initial_plan: proposed, updated_assessment: restored.assess(observation.segmentId, '2026-10-24T09:03:00Z'),
  reviewed_plan: revised, audit: restored.audit(),
};
const output = process.argv.includes('--evidence')
  ? resolve('docs/evidence/world-model-2026-10-24.json') : join(directory, 'receipt.json');
writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ receipt: output, forwardIgnoredAsIndependentWitness: true,
  durableReplay: true, finalPlanStatus: revised.status, reason: revised.reason }, null, 2));
