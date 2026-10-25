import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { configuredKobo } from '../src/lib/server/kobo';
import type { MissionView } from '../src/lib/server/mission-runtime';

const origin = 'http://127.0.0.1:8080';
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ operation: 'Start a watched investigation, submit one labelled forwarded-report demonstration, verify automatic invalidation and fresh federated planning, then stop this watch.',
    requires: ['Local live-mode interface', 'Kobo project and Nightshift', 'Provisioned community source in Zetaris'],
    writes: 'One idempotent demonstration submission in your own Kobo project. No incident or dispatch asserted.' }, null, 2));
  process.exit(0);
}
const source = configuredKobo();
const initial = await source.snapshot();
const fixture = '.runtime/kobo/transport-test-road-blockage.json';
if (existsSync(fixture)) {
  const saved = JSON.parse(readFileSync(fixture, 'utf8'));
  if (initial.records.some(r => (r.raw as Record<string, unknown>)['_uuid'] === saved.uuid)) throw new Error('This demonstration UUID is already present. Preserve the earlier proof; submit a separate labelled form manually for another live test.');
}
if (initial.records.some(r => r.signal.mode !== 'demo')) throw new Error('This public demonstration check requires a project containing only labelled demo records.');
async function state(runId?: string): Promise<MissionView> {
  const response = await fetch(`${origin}/api/mission${runId ? `?run=${encodeURIComponent(runId)}` : ''}`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error('Local live mission service is unavailable.');
  return response.json() as Promise<MissionView>;
}
async function waitFor(predicate: (view: MissionView) => boolean, runId?: string) {
  const deadline = Date.now() + 360_000;
  while (Date.now() < deadline) { const view = await state(runId); if (predicate(view)) return view; await Bun.sleep(1000); }
  throw new Error('Live-change verification exceeded its bounded wait.');
}
const ready = await state();
if (ready.mode !== 'live' || ready.activeRunId) throw new Error('Use an idle live-mode interface for this demonstration.');
const currentRevision = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { stdout: 'pipe' }).stdout.toString().trim();
const dirty = Bun.spawnSync(['git', 'status', '--porcelain', '--', 'src', 'scripts', 'package.json', 'data'], { stdout: 'pipe' }).stdout.toString().trim();
if (dirty || ready.applicationSourceCommit !== currentRevision) throw new Error('Commit the application changes and restart the local server before capturing exact-revision live proof.');
const start = await fetch(`${origin}/api/mission`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'investigate', message: 'Demonstration: investigate Bambili community evidence and registered logistics. Identify what must be verified before delivery planning.', watchMinutes: 30 }) });
if (start.status !== 202) throw new Error('The live investigation was not accepted.');
const { runId } = await start.json() as { runId: string };
try {
  const before = await waitFor(view => view.selected?.status !== 'running', runId);
  const baseline = before.assessments.find(a => a.id === before.selected?.result?.assessmentId);
  if (baseline?.status !== 'checked' || baseline.evidence.mode !== 'live-zetaris') throw new Error('Baseline did not complete actual federated planning and an independent check.');
  console.log(JSON.stringify({ phase: 'baseline_checked', runId, reports: baseline.evidence.reportCount, revision: baseline.evidence.revision }));
  const submit = Bun.spawnSync(['bun', 'scripts/check-kobo.ts', '--submit-demo', '--demo-case=road-blockage'], { stdout: 'pipe', stderr: 'pipe' });
  if (submit.exitCode) throw new Error('Labelled Kobo demonstration failed; inspect the local transport receipt.');
  console.log(JSON.stringify({ phase: 'demonstration_submitted', note: 'Awaiting the application monitor, not launching another agent manually.' }));
  const after = await waitFor(view => view.selected?.id !== runId && view.selected?.sessionId === before.selected?.sessionId &&
    view.selected?.cause === 'source_change' && view.selected.status === 'complete');
  const next = after.assessments.find(a => a.id === after.selected?.result?.assessmentId);
  const history = await state(runId); const old = history.assessments.find(a => a.id === baseline.id);
  const independentlyChecked = next?.checks.some(check => check.matched && check.evidence.revision === next.evidence.revision &&
    check.evidence.queries.length === 2 && check.evidence.queries.every(q => !next.evidence.queries.some(p => p.id === q.id)));
  if (next?.status !== 'checked' || !independentlyChecked || old?.status !== 'invalidated' || next.evidence.revision === baseline.evidence.revision ||
      next.evidence.reportCount !== baseline.evidence.reportCount + 1 || next.evidence.forwardedCount !== baseline.evidence.forwardedCount + 1 ||
      next.evidence.liveCount !== 0 || !next.evidence.rows.some(r => r.name === 'Bambili' && r.blockers >= 1) ||
      next.evidence.rows.some(r => r.verifiedOrigins !== 0)) throw new Error('Automatic federated drift proof did not satisfy its assertions.');
  const sourceFiles = ['src/lib/server/community-evidence.ts','src/lib/server/mission-logistics.ts','src/lib/server/mission-coordinator.ts',
    'src/lib/server/mission-journal.ts','src/lib/server/mission-runtime.ts','scripts/demo-live-change.ts','scripts/provision-community-data.ts'];
  const revision = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { stdout: 'pipe' }).stdout.toString().trim();
  const receipt = { capturedAt: new Date().toISOString(), applicationSourceCommit: revision,
    note: 'Actual Kobo, Zetaris and Nemotron transport over labelled demonstration observations and expired synthetic logistics. No field incident verified or dispatch authorized.',
    provision: JSON.parse(readFileSync('.runtime/community-v1/provision.json', 'utf8')),
    baseline: { run: before.selected, assessment: baseline, events: before.events },
    changed: { run: after.selected, assessment: next, events: after.events },
    priorAssessment: { id: old.id, status: old.status, reason: old.reason },
    checks: { automaticTrigger: true, previousAssessmentInvalidated: true, freshIndependentQuery: true,
      forwardedNotIndependent: true, reportVisibleInZetaris: true, actualFieldIncidentsVerified: false, dispatchAuthorized: false },
    sourceFiles: sourceFiles.map(file => ({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') })) };
  mkdirSync('.runtime/live-change', { recursive: true });
  writeFileSync('.runtime/live-change/receipt.json', JSON.stringify(receipt, null, 2) + '\n');
  if (process.argv.includes('--evidence')) {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const target = `docs/evidence/federated-live-change-${date}.json`;
    if (existsSync(target)) throw new Error('Preserved live-change evidence already exists; refusing to overwrite it.');
    writeFileSync(target, JSON.stringify(receipt, null, 2) + '\n');
  }
  console.log(JSON.stringify({ phase: 'verified', fromRun: runId, toRun: after.selected!.id, oldStatus: old.status,
    newStatus: next.status, demoReports: next.evidence.demoCount, liveReports: next.evidence.liveCount, checks: receipt.checks }, null, 2));
} finally {
  const latest = await state().catch(() => null);
  if (latest?.runs.some(r => r.id === runId && r.sessionId === latest.selected?.sessionId)) {
    await fetch(`${origin}/api/mission`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{"action":"stop_monitor"}' });
  }
}
