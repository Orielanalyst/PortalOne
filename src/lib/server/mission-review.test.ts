// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { MissionJournal } from './mission-journal';
import { MissionRuntime } from './mission-runtime';
import { FixtureCommunityEvidence } from './community-evidence';
import { CommunityMap } from './community-map';
import { replayCommunitySource } from './mission-replay';
import { publicRequirements, withMissionRequirements } from './mission-requirements';
import { missionFeasibility } from './mission-feasibility';
import { reviewCandidate, assertReviewMatches, exportedReview } from './mission-review';
import type { ReviewSubmission } from './mission-review';
import type { MissionValues } from './mission-requirements';
import { observeMissionEvidence } from './mission-world';
import {buildDossier} from './mission-dossier';
const at = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
async function setup() {
  const journal = new MissionJournal(':memory:'), snapshot = await replayCommunitySource.snapshot();
  const base = new FixtureCommunityEvidence(new CommunityMap()), source = { origin: null, snapshot: vi.fn(async () => snapshot) };
  const publicSource = { async snapshot() { return { source: 'ReliefWeb public RSS' as const, sourceUrl: 'https://reliefweb.int/updates/rss.xml?search=Cameroon',
    revision: 'fixture-public', status: 'available' as const, checkedAt: new Date().toISOString(), cached: false, reports: [], feedSha256: null, gap: 'Explicit unit-test fixture, no live fetch.' }; } };
  const runtime = new MissionRuntime({ journal, source, evidence: base, publicSource, dispatcher: { async choose(context) { return { task: context.allowed[0]!, detail: 'Explicit unit-test decision.' }; } } });
  const a = runtime.map.places.find(p => p.name === 'Bamenda')!, b = runtime.map.places.find(p => p.name === 'Bambili')!;
  runtime.map.layers['roads'] = { type: 'FeatureCollection', features: [{ type: 'Feature', id: 'fixture-road', properties: { evidenceId: 'fixture-road', id: 'way/1', highway: 'primary' }, geometry: { type: 'LineString', coordinates: [[a.lng, a.lat], [b.lng, b.lat]] } }] };
  const turn = journal.beginConversation('Explicit mission exercise', 'live-model'); journal.finishConversation(turn.id, 'Fixture inputs.', 'reply');
  const values: MissionValues = { mode: 'demonstration', origin: 'Bamenda', destination: 'Bambili', beneficiaries: 200, cargoLabel: 'relief kits',
    quantity: 80, unitMassKg: 5, departAt: at(60), deadline: at(180), stockUnits: 100, stockObservedAt: at(-10), stockValidUntil: at(240),
    vehicleName: 'Exercise truck', payloadKg: 600, tareKg: 2000, fuelLitres: 100, litresPerKm: 0.2, fourWheelDrive: true, vehicleAvailable: true,
    vehicleObservedAt: at(-10), vehicleValidUntil: at(240), planningSpeedKph: 30, handlingMinutes: 20, bufferMinutes: 20, fuelReserveLitres: 10 };
  const messages = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  const profile = journal.updateRequirements(turn.sessionId, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value, support: `${key}=${value}` }])), messages, turn.id);
  const run = journal.startRun('Prepare a Bamenda-Bambili exercise', 'test', turn.sessionId); journal.bindRequirements(run.id); journal.ingest(snapshot);
  const integrated = (runtime as unknown as { evidence: { load: typeof base.load } }).evidence;
  const context = withMissionRequirements(await integrated.load(snapshot, AbortSignal.timeout(3000)), profile);
  await observeMissionEvidence(runtime.world, journal, context, run.id);
  const assessmentId = journal.recordAssessment(run.id, context, { placeId: null, nextAction: 'clarify_mission', rationale: 'Explicit test fixture.' }); journal.checkAssessment(assessmentId, context);
  const planId = journal.beginDocument({ runId: run.id, actor: 'planner', kind: 'plan', title: 'Fixture plan v1', version: 1 });
  journal.appendDocument(planId, 'Explicit unit-test proposal with operational holds.'); journal.finishDocument(planId, 'published', { evidenceRevision: context.revision });
  await runtime.world.recordPlan({ runId: run.id, documentId: planId, version: 1, evidence: context });
  const critique = journal.beginDocument({ runId: run.id, actor: 'evaluator', kind: 'critique', title: 'Fixture review', version: 1 });
  journal.appendDocument(critique, '**Verdict: ACCEPT_WITH_GAPS**'); journal.finishDocument(critique, 'published');
  journal.saveFeasibility(run.id, missionFeasibility(profile, runtime.map));
  journal.saveBundle({ runId: run.id, status: 'ready', revision: context.revision, files: [], note: 'Unit-test fixture, not an exported pack.', createdAt: new Date().toISOString() });
  journal.finish(run.id, { disposition: 'hold', summary: 'Explicit fixture.', gaps: [], signalIds: snapshot.records.map(r => r.signal.id), placeIds: [], demoReports: snapshot.count, liveReports: 0, assessmentId });
  const candidate = reviewCandidate(journal, run.id)!;
  const command: ReviewSubmission = { requestId: randomUUID(), runId: run.id, planId, version: 1, planSha256: candidate.planSha256,
    evidenceRevision: candidate.evidenceRevision, requirementsRevision: profile.revision, calculationId: candidate.calculationId,
    decision: 'approve', comment: 'Controlled test review.', acknowledgedHolds: true };
  return { runtime, journal, profile, run, source, context, command, values };
}
it('recovers only a failed unchanged export, retaining the published plan and requiring a final source check',async()=>{
  const f=await setup();
  try{
    const dossier=buildDossier(f.run.id,f.run.message,await f.source.snapshot(),f.context,f.runtime.map);f.journal.saveCitations(dossier.citations);
    const report=f.journal.beginDocument({runId:f.run.id,actor:'reporter',kind:'report',title:'Explicit recovery test narrative'});f.journal.appendDocument(report,'Published unit-test narrative; no actual PDF or model claimed.');f.journal.finishDocument(report,'published',{evidenceRevision:f.context.revision});
    f.journal.saveBundle({runId:f.run.id,status:'failed',revision:f.context.revision,files:[],note:'Explicit fixture export failure',createdAt:new Date().toISOString()});
    const before=f.journal.documents(f.run.id).map(doc=>[doc.id,doc.markdown]);
    const exporter=vi.fn(async(input:Parameters<import('./committee-mission').CommitteeExporter>[0])=>{await input.validateEvidence();input.journal.saveBundle({runId:f.run.id,status:'ready',revision:f.context.revision,files:[],note:'Unit-test exporter, not a native pack.',createdAt:new Date().toISOString()});});
    (f.runtime as unknown as {options:{committeeExporter:typeof exporter}}).options.committeeExporter=exporter;
    expect(await f.runtime.retryExport(f.run.id,30)).toEqual({runId:f.run.id,status:'ready'});expect(exporter).toHaveBeenCalledOnce();
    expect(f.journal.documents(f.run.id).map(doc=>[doc.id,doc.markdown])).toEqual(before);expect(f.journal.events(f.run.id).some(event=>event.kind==='export_recovered')).toBe(true);
    await expect(f.runtime.retryExport(f.run.id)).rejects.toThrow('failed export');
  }finally{f.runtime.stopMonitor();f.journal.close();}
});
it('does not recover an export after its source identity changes',async()=>{
  const f=await setup();
  try{
    const dossier=buildDossier(f.run.id,f.run.message,await f.source.snapshot(),f.context,f.runtime.map);f.journal.saveCitations(dossier.citations);
    const report=f.journal.beginDocument({runId:f.run.id,actor:'reporter',kind:'report',title:'Explicit recovery fixture'});f.journal.appendDocument(report,'Published test narrative');f.journal.finishDocument(report,'published',{evidenceRevision:f.context.revision});
    f.journal.saveBundle({runId:f.run.id,status:'failed',revision:f.context.revision,files:[],note:'Fixture failure',createdAt:new Date().toISOString()});
    const snapshot=await f.source.snapshot();f.source.snapshot.mockResolvedValue({...snapshot,sourceId:snapshot.sourceId+'-changed'});
    const exporter=vi.fn();(f.runtime as unknown as {options:{committeeExporter:typeof exporter}}).options.committeeExporter=exporter;
    await expect(f.runtime.retryExport(f.run.id)).rejects.toThrow('could not be recovered');expect(exporter).not.toHaveBeenCalled();expect(f.journal.bundle(f.run.id)?.status).toBe('failed');
  }finally{f.runtime.stopMonitor();f.journal.close();}
});
it('refreshes sources, binds an exact proposal and input version, preserves holds and is idempotent', async () => {
  const f = await setup();
  try {
    expect(reviewCandidate(f.journal, f.run.id)?.canApprove).toBe(true);
    const result = await f.runtime.review(f.command);
    expect(f.source.snapshot).toHaveBeenCalledTimes(1);
    expect(result.review).toMatchObject({ decision: 'approve', status: 'active', scope: 'committee_proposal_only', dispatchAuthorized: false, requirementsRevision: f.profile.revision });
    expect(result.review.refreshedAt).toBeTruthy(); expect(Date.parse(result.review.validUntil!)).toBeLessThanOrEqual(Date.now() + 10 * 60_000);
    await f.runtime.review(f.command); expect(f.source.snapshot).toHaveBeenCalledTimes(1); expect(f.journal.reviews(f.run.id)).toHaveLength(1);
    expect(exportedReview(result.review)).not.toHaveProperty('comment');
    expect(f.journal.reviews(f.run.id, Date.now() + 11 * 60_000)[0]?.status).toBe('expired');
  } finally { f.runtime.stopMonitor(); f.journal.close(); }
});
it('refuses changed hashes, missing acknowledgement and a drift arriving during source refresh', async () => {
  const f = await setup();
  try {
    expect(() => assertReviewMatches({ ...f.command, planSha256: 'a'.repeat(64) }, reviewCandidate(f.journal, f.run.id))).toThrow('changed');
    await expect(f.runtime.review({ ...f.command, acknowledgedHolds: false })).rejects.toThrow('Acknowledge');
    f.source.snapshot.mockImplementation(async () => { f.journal.updateRequirements(f.run.sessionId, { quantity: { value: 90, support: '90 kits' } }, ['90 kits'], 'changed-turn'); return await replayCommunitySource.snapshot(); });
    await expect(f.runtime.review(f.command)).rejects.toThrow('changed'); expect(f.journal.reviews(f.run.id)).toHaveLength(0);
    expect(f.journal.currency(f.run.id).status).toBe('superseded');
  } finally { f.runtime.stopMonitor(); f.journal.close(); }
});
it('withdraws approval on new evidence and retains the original decision as history', async () => {
  const f = await setup();
  try {
    await f.runtime.review(f.command);
    const changed = { ...f.context, revision: 'b'.repeat(64), dependencyBaseRevision: 'c'.repeat(64) };
    await observeMissionEvidence(f.runtime.world, f.journal, changed, f.run.id);
    expect(f.journal.reviews(f.run.id)[0]).toMatchObject({ status: 'invalidated', decision: 'approve', planSha256: f.command.planSha256 });
    expect(f.runtime.world.view(f.run.id).plans[0]?.status).toBe('invalidated');
    await expect(f.runtime.review({ ...f.command, requestId: randomUUID() })).rejects.toThrow('changed');
  } finally { f.runtime.stopMonitor(); f.journal.close(); }
});
it('requires a reason for rejection and makes a declined proposal historical', async () => {
  const f = await setup();
  try {
    await expect(f.runtime.review({ ...f.command, decision: 'reject', comment: '' })).rejects.toThrow('reason');
    const result = await f.runtime.review({ ...f.command, decision: 'reject', comment: 'Need actual endpoint confirmation.' });
    expect(result.review.decision).toBe('reject'); expect(f.source.snapshot).not.toHaveBeenCalled();
    expect(f.journal.currency(f.run.id).status).toBe('superseded');
  } finally { f.runtime.stopMonitor(); f.journal.close(); }
});
it('a request for changes commissions a linked replacement and preserves the exact operator instruction',async()=>{
  const f=await setup();
  try {
    const result=await f.runtime.review({...f.command,decision:'request_changes',comment:'Assign a named role to verify the delivery entrance.'});
    expect(result.replacementRunId).toBeTruthy();expect(f.journal.lineage(f.run.id).replacementRunId).toBe(result.replacementRunId);
    expect(f.journal.reviewForRevision(result.replacementRunId!)?.comment).toBe('Assign a named role to verify the delivery entrance.');
    expect(f.journal.documents(f.run.id).some(d=>d.id===f.command.planId)).toBe(true);
    await vi.waitFor(()=>expect(f.runtime.state().activeRunId).toBeNull(),{timeout:5000});
  }finally{f.runtime.stopMonitor();f.journal.close();}
});
