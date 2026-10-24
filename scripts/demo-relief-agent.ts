import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runRelief } from '../src/lib/server/relief-agent';
import { FixtureReliefSource, readScenario, ZetarisReliefSource } from '../src/lib/server/relief-source';
import { EnumerationReliefPlanner, NightshiftReliefPlanner } from '../src/lib/server/relief-planner';
import { ReliefWorld } from '../src/lib/server/relief-world';
import { configuredZetaris } from '../src/lib/server/zetaris';
import { configuredNightshift } from '../src/lib/server/runtime-config';

const live = process.argv.includes('--live');
const evidence = process.argv.includes('--evidence');
const pack = readScenario();
const source = live ? new ZetarisReliefSource(configuredZetaris()) : new FixtureReliefSource();
const planner = live ? new NightshiftReliefPlanner(configuredNightshift()) : new EnumerationReliefPlanner();
const world = new ReliefWorld({ namespace: live ? 'live-relief-v1' : 'offline-relief-v1', directory: resolve('.runtime/world-model') });
const initial = await runRelief({ mission: pack.mission, asOf: pack.clock, source, planner, world,
  initialDraft: { routeId: 'sim-direct', vehicleId: 'sim-heavy-truck',
    rationale: 'Synthetic stress-test input: try the heavy truck on the direct route. Independent validation required.' } });
mkdirSync(resolve('.runtime'), { recursive: true });
writeFileSync('.runtime/relief-initial-debug.json', JSON.stringify(initial, null, 2) + '\n');
if (initial.disposition !== 'operator_review' || !initial.events.some(e => e.kind === 'rejected' && e.detail.includes('GROSS_WEIGHT_EXCEEDED')) ||
    !initial.trackedPlan) throw new Error('Initial rejection/revision case did not pass. Inspect the runtime trace.');
const changed = await source.load(pack.mission, pack.changedAt);
for (const observation of changed.observations) await world.capture(observation);
const invalidated = await world.reviewPlan(initial.trackedPlan.id, pack.changedAt);
if (invalidated.status !== 'invalidated') throw new Error('Changed evidence did not invalidate the initial plan.');
const replanned = await runRelief({ mission: pack.mission, asOf: pack.changedAt, source, planner, world });
writeFileSync('.runtime/relief-replan-debug.json', JSON.stringify(replanned, null, 2) + '\n');
if (replanned.disposition !== 'operator_review' || replanned.proposal?.routeId !== 'sim-detour') throw new Error('Changed-evidence replan did not pass.');
const impossible = await runRelief({ mission: { ...pack.mission, deadline: '2026-10-24T09:45:00Z' },
  asOf: pack.clock, source, planner, world });
if (impossible.disposition !== 'hold') throw new Error('Impossible deadline must hold.');
const sourceFiles = ['relief-agent', 'relief-planner', 'relief-validator', 'relief-source', 'relief-data', 'relief-world', 'meterless', 'zetaris'];
const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
let checkout: { commit: string | null; dirty: boolean | null } = { commit: null, dirty: null };
try {
  const commit = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { stdout: 'pipe', stderr: 'pipe' });
  const status = Bun.spawnSync(['git', 'status', '--porcelain', '--', 'src/lib/server', 'scripts/demo-relief-agent.ts'], { stdout: 'pipe', stderr: 'pipe' });
  if (commit.exitCode === 0 && status.exitCode === 0) checkout = { commit: commit.stdout.toString().trim(), dirty: Boolean(status.stdout.toString().trim()) };
} catch { /* Source archives and standalone replay do not require Git. */ }
const entry = fileURLToPath(import.meta.url);
const receipt = { capturedAt: new Date().toISOString(), mode: live ? 'Live local Zetaris and Nightshift over synthetic inputs' : 'Offline fixture and enumeration; no sponsor calls',
  sourceCheckout: checkout,
  entryArtifact: { file: relative(process.cwd(), entry).replaceAll('\\', '/'), sha256: hash(readFileSync(entry)) },
  sourceHashes: sourceFiles.map(name => {
    const file = `src/lib/server/${name}.ts`;
    if (!existsSync(file)) return { file, available: false };
    const data = readFileSync(file);
    return { file, available: true, sha256: hash(data), sha256_lf: hash(data.toString('utf8').replaceAll('\r\n', '\n')) };
  }),
  sourceHashScope: 'Files present at capture; actual executed script or bundle is identified separately by entryArtifact',
  inputManifest: 'data/relief-scenario-v1/manifest.json',
  inputManifestSha256: hash(readFileSync('data/relief-scenario-v1/manifest.json')),
  initialDraftOrigin: 'Explicit synthetic stress-test fixture, not an AI-generated draft or a human approval',
  checks: { grossWeightRejected: true, revisedForOperatorReview: true, changedEvidenceInvalidated: true,
    replannedToDetour: true, impossibleMissionHeld: true, dispatchAuthorized: false },
  initial, changedEvidenceQueries: changed.queries, invalidated, replanned, impossible };
const output = evidence && live ? 'docs/evidence/relief-agent-live-2026-10-24.json'
  : evidence ? 'docs/evidence/relief-agent-offline-2026-10-24.json' : '.runtime/last-relief-agent.json';
mkdirSync(resolve('.runtime'), { recursive: true });
writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ receipt: output, mode: receipt.mode, checks: receipt.checks,
  runs: [initial, replanned, impossible].map(r => ({ disposition: r.disposition, proposal: r.proposal,
    queryCount: r.queries.length, reservedQuerySlots: r.reservedQuerySlots, durationMs: r.durationMs, models: r.models })) }, null, 2));
