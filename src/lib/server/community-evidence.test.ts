// @vitest-environment node
import { CommunityMap } from './community-map';
import { normalizeKobo } from './kobo';
import type { KoboSnapshot } from './kobo';
import { FixtureCommunityEvidence, ZetarisCommunityEvidence, projectEvidence, projectionSql, communityQueries } from './community-evidence';
import type { MissionEvidence } from './community-evidence';
import { MissionJournal } from './mission-journal';
import { runMission } from './mission-coordinator';
import { FixtureMissionLogistics, validateAdvice } from './mission-logistics';

const map = new CommunityMap(), signal = () => AbortSignal.timeout(5000);
const raw = (extra = {}) => ({ _id: 1, _uuid: 'source-1', report_mode: 'demo', observed_at: '2026-10-25T06:00:00Z',
  place_name: 'Bambili', category: 'other', report_text: 'DEMONSTRATION', source_relation: 'direct', ...extra });
const snapshot = (values = [raw()]): KoboSnapshot => ({ sourceId: 'test-federation', checkedAt: '2026-10-25T07:00:00Z', count: values.length,
  records: values.map(v => normalizeKobo(v, 'project123', '2026-10-25T07:00:00Z')) });
const fixture = new FixtureCommunityEvidence(map);
const dispatcher = { async choose(context: { allowed: any[] }) { return { task: context.allowed[0], detail: 'Choose the next bounded task.' }; } };

it('projects no raw text, reporter reference or GPS; receipt time does not create another version', () => {
  const input = snapshot([raw({ report_text: "Private text'); DROP TABLE inventory;--", origin_reference: 'private-person', location: '6.002 10.251 1 5' })]);
  const projected = projectEvidence(input, map); const text = JSON.stringify(projected);
  expect(text).not.toContain('Private text'); expect(text).not.toContain('private-person'); expect(text).not.toContain('6.002');
  const again = structuredClone(input); again.records[0]!.signal.receivedAt = '2026-10-25T08:00:00Z';
  expect(projectEvidence(again, map).id).toBe(projected.id);
  expect(projectionSql(projected)).not.toContain('DROP TABLE');
  expect(() => communityQueries("';DELETE FROM inventory")).toThrow();
  expect(() => projectionSql({ ...projected, id: "';DELETE" })).toThrow();
});
it('preserves ambiguity without multiplying global report counts and keeps logistics simulated/stale', async () => {
  const context = await fixture.load(snapshot([raw(), raw({ _id: 2, _uuid: 'balewa', place_name: 'Balewa' })]), signal());
  expect(context.reportCount).toBe(2); expect(context.rows).toHaveLength(3);
  expect(context.rows.filter(r => r.ambiguous)).toHaveLength(2);
  expect(context.rows.find(r => r.name === 'Bambili')).toMatchObject({ stockUnits: 120, fleetCount: 2, logisticsSimulated: true, stockFresh: false, fleetFresh: false });
  expect(context.rows.every(r => r.verifiedOrigins === 0)).toBe(true);
  expect(() => validateAdvice({ placeId: 'invented', nextAction: 'verify_location', rationale: 'Invented' }, context)).toThrow();
});
it('treats future logistics as unavailable and expires the evidence basis at the exact boundary', async () => {
  try {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-24T08:44:59Z'));
    expect((await fixture.load(snapshot(), signal())).rows[0]?.stockFresh).toBe(false);
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-24T09:00:00Z'));
    const active = await fixture.load(snapshot(), signal()); expect(active.rows[0]?.stockFresh).toBe(true);
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-24T11:00:00Z'));
    const expired = await fixture.load(snapshot(), signal()); expect(expired.rows[0]?.stockFresh).toBe(false);
    expect(expired.revision).not.toBe(active.revision);
  } finally { vi.restoreAllMocks(); }
});
it('invalidates a persisted checked assessment after a new report or deleted record changes the batch', async () => {
  const journal = new MissionJournal(':memory:');
  try {
    const initial = await fixture.load(snapshot(), signal()); const run = journal.startRun('Bambili', 'operator');
    const advice = await new FixtureMissionLogistics().assess('Bambili', initial, signal());
    const id = journal.recordAssessment(run.id, initial, advice.advice);
    expect(journal.checkAssessment(id, initial)).toBe(true); expect(journal.assessments(run.id)[0]?.status).toBe('checked');
    expect(journal.observeEvidence(initial)).toHaveLength(0);
    const removed = await fixture.load(snapshot([]), signal()); expect(journal.observeEvidence(removed)).toEqual([id]);
    expect(journal.assessments(run.id)[0]?.status).toBe('invalidated'); expect(journal.checkAssessment(id, initial)).toBe(false);
    expect(journal.events(run.id).some(e => e.kind === 'assessment_invalidated')).toBe(true);
  } finally { journal.close(); }
});
it('routes a changed federated snapshot back to logistics and independently checks the new assessment', async () => {
  const journal = new MissionJournal(':memory:'); let loads = 0;
  try {
    const evidence: MissionEvidence = { async load(input, abort) {
      const context = await fixture.load(input, abort);
      if (++loads >= 2) { context.rows[0]!.stockUnits = 119; context.revision = 'changed-logistics-revision'; }
      return context;
    } };
    const run = journal.startRun('Investigate Bambili', 'operator');
    const result = await runMission({ run, journal, map, dispatcher, evidence, readSource: async () => snapshot() });
    expect(result.disposition).toBe('hold');
    expect(journal.events(run.id).filter(e => e.kind === 'task_started').map(e => e.actor)).toEqual(['recon', 'mapping', 'recon', 'logistics', 'checker', 'logistics', 'checker']);
    expect(journal.assessments(run.id).map(a => a.status)).toEqual(['invalidated', 'checked']);
    expect(loads).toBe(4);
  } finally { journal.close(); }
});
it('holds after repeated changes exhaust the planning-revision budget', async () => {
  const journal = new MissionJournal(':memory:'); let revision = 0;
  try {
    const run = journal.startRun('Investigate changing evidence', 'operator');
    const result = await runMission({ run, journal, map, dispatcher, readSource: async () => snapshot(), evidence: { async load(input, abort) {
      return { ...await fixture.load(input, abort), revision: `changing-${++revision}` };
    } } });
    expect(result.disposition).toBe('hold'); expect(journal.assessments(run.id).every(a => a.status === 'invalidated')).toBe(true);
    expect(journal.events(run.id).filter(e => e.kind === 'task_started' && e.actor === 'logistics')).toHaveLength(3);
  } finally { journal.close(); }
});
it('does not fabricate a federated result when the data layer fails', async () => {
  const journal = new MissionJournal(':memory:');
  try {
    const run = journal.startRun('Investigate Bambili', 'operator');
    const result = await runMission({ run, journal, map, dispatcher, readSource: async () => snapshot(), evidence: { async load() { throw new Error('private SQL payload'); } } });
    expect(result.disposition).toBe('hold'); expect(journal.assessments(run.id)).toHaveLength(0);
    expect(JSON.stringify(journal.events(run.id))).not.toContain('private SQL payload');
  } finally { journal.close(); }
});
it('returns a rejected delegation to the coordinator for bounded correction instead of skipping the planning gate', async () => {
  const journal = new MissionJournal(':memory:'); let skipped = false, corrected = false;
  try {
    const run = journal.startRun('Investigate Bambili', 'operator');
    const result = await runMission({ run, journal, map, readSource: async () => snapshot(), dispatcher: { async choose(context) {
      if (!skipped && context.allowed[0] === 'logistics.assess') { skipped = true; return { task: 'checker.check', detail: 'Attempt to check early' }; }
      if (context.correction) corrected = true;
      return { task: context.allowed[0]!, detail: 'Select a permitted task.' };
    } } });
    expect(result.assessmentId).toBeDefined(); expect(corrected).toBe(true);
    expect(journal.events(run.id).filter(e => e.kind === 'delegation_rejected')).toHaveLength(1);
    expect(journal.assessments(run.id)[0]?.status).toBe('checked');
  } finally { journal.close(); }
});
it.each(['stale_batch', 'missing_group'])('rejects %s from the federated engine instead of handing it to the model', async fault => {
  const input = snapshot(), projection = projectEvidence(input, map);
  const query = vi.fn()
    .mockResolvedValueOnce({ headers: ['id','report_count','actual_count','demo_count','live_count','forwarded_count'],
      data: [[fault === 'stale_batch' ? 'stale' : projection.id,1,1,1,0,0]], total: 1 })
    .mockResolvedValueOnce({ headers: [], data: [], total: 0 });
  const evidence = new ZetarisCommunityEvidence(map, { query }, async () => JSON.stringify({ batch: projection.id, reports: 1 }));
  await expect(evidence.load(input, signal())).rejects.toThrow(fault === 'stale_batch' ? 'batch verification' : 'community join was empty');
});
