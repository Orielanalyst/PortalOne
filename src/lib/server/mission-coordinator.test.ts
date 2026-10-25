// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeKobo, KoboClient, officialKoboServer } from './kobo';
import type { KoboSnapshot } from './kobo';
import { MissionJournal } from './mission-journal';
import { CommunityMap } from './community-map';
import { runMission } from './mission-coordinator';
import type { MissionDispatcher } from './mission-coordinator';

const at = '2026-10-25T06:00:00Z';
const raw = (extra = {}) => ({ _id: 1, _uuid: 'demo-uuid', report_mode: 'demo', observed_at: at, place_name: 'Bambili', category: 'other',
  report_text: 'Demonstration only', source_relation: 'direct', ...extra });
const snapshot = (values = [raw()]): KoboSnapshot => ({ sourceId: 'kobo:project123', checkedAt: at, count: values.length,
  records: values.map(v => normalizeKobo(v, 'project123', at)) });
const map = new CommunityMap();
const dispatcher: MissionDispatcher = { async choose(context) { return { task: context.allowed[0]!, detail: 'Delegate the next required evidence task.' }; } };

it('deduplicates polls, preserves edits and survives reopening the SQLite journal', () => {
  const directory = mkdtempSync(join(tmpdir(), 'relief-journal-')); let journal: MissionJournal | undefined;
  try {
    const path = join(directory, 'journal.sqlite'); journal = new MissionJournal(path);
    const first = journal.ingest(snapshot()); expect(first.changed).toHaveLength(1);
    expect(journal.ingest(snapshot()).changed).toHaveLength(0);
    const edited = snapshot([raw({ report_text: 'Demonstration edit' })]);
    expect(journal.ingest(edited).changed).toHaveLength(1); expect(journal.signals()).toHaveLength(1);
    expect(journal.signalsByIds(first.changed)[0]?.id).toBe(first.changed[0]);
    expect(journal.currentSignals(snapshot([]))).toHaveLength(0); // retained history cannot substitute for an empty current scan.
    const run = journal.startRun('Investigate Bambili', 'operator'); journal.event(run.id, 'coordinator', 'started', 'Started');
    journal.close(); journal = new MissionJournal(path);
    expect(journal.signals()[0]?.id).toBe(edited.records[0]?.signal.id);
    expect(journal.events(run.id)).toHaveLength(1);
    journal.interrupt(run.id); expect(journal.run(run.id)?.status).toBe('interrupted');
  } finally { journal?.close(); rmSync(directory, { recursive: true, force: true }); }
});
it('lets the supervisor check early but requires a fresh final check after the targeted follow-up', async () => {
  const journal = new MissionJournal(':memory:'); let pickedEarly = false;
  try {
    const run = journal.startRun('Check readiness early, then investigate the missing evidence', 'operator');
    const result = await runMission({ run, journal, map, readSource: async () => snapshot(), dispatcher: { async choose(context) {
      if (!pickedEarly && context.allowed.length > 1) { pickedEarly = true; return { task: 'checker.check', detail: 'Check constraints before further investigation.' }; }
      return dispatcher.choose(context, AbortSignal.timeout(1000));
    } } });
    expect(result.disposition).toBe('hold');
    expect(journal.events(run.id).filter(e => e.kind === 'task_started').map(e => e.actor)).toEqual(['recon', 'checker', 'mapping', 'recon', 'checker']);
  } finally { journal.close(); }
});
it('terminates on deadline even when a dependency ignores cancellation, without late evidence writes', async () => {
  const journal = new MissionJournal(':memory:');
  try {
    const run = journal.startRun('Investigate Bambili', 'operator');
    const result = await runMission({ run, journal, map, dispatcher, timeoutMs: 15,
      readSource: () => new Promise(resolve => setTimeout(() => resolve(snapshot()), 70)) });
    expect(result.summary).toContain('deadline'); const count = journal.events(run.id).length;
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(journal.events(run.id)).toHaveLength(count); expect(journal.signals()).toHaveLength(0);
  } finally { journal.close(); }
});
it('grounds exact places, preserves duplicate names, and leaves unknown places unresolved', () => {
  const known = map.resolve(snapshot().records[0]!.signal);
  expect(known).toMatchObject({ status: 'named_place', candidates: [{ name: 'Bambili' }] });
  expect(known.gap).toContain('exact incident location');
  expect(map.resolve(snapshot([raw({ place_name: 'Balewa' })]).records[0]!.signal).status).toBe('ambiguous');
  expect(map.resolve(snapshot([raw({ place_name: 'Unmapped landmark 123' })]).records[0]!.signal)).toMatchObject({ status: 'unresolved', location: null });
  expect(map.resolve(snapshot([raw({ location: '0 0 0 5' })]).records[0]!.signal).status).toBe('unresolved');
});
it('never turns forwards or matching content into verified independent origins', () => {
  const inputs = snapshot([raw({ report_mode: 'live' }), raw({ _id: 2, _uuid: 'copy', source_relation: 'forwarded', report_mode: 'live' })]);
  expect(inputs.records[0]?.signal.contentFingerprint).toBe(inputs.records[1]?.signal.contentFingerprint);
  expect(inputs.records.every(i => !i.signal.originVerified)).toBe(true);
  expect(inputs.records[1]?.signal.relation).toBe('forwarded');
});
it('delegates isolated specialist tasks and sends a targeted follow-up on the returned evidence gap', async () => {
  const journal = new MissionJournal(':memory:');
  try {
    const readSource = vi.fn(async () => snapshot());
    const run = journal.startRun('Investigate Bambili', 'operator');
    const result = await runMission({ run, journal, map, dispatcher, readSource });
    expect(result).toMatchObject({ disposition: 'hold', demoReports: 1, liveReports: 0 });
    expect(result.placeIds).toContain('places-node:1744470346'); expect(readSource).toHaveBeenCalledTimes(3);
    const tasks = journal.events(run.id).filter(e => e.kind === 'task_started');
    expect(tasks.map(t => t.actor)).toEqual(['recon', 'mapping', 'recon', 'checker']);
    expect(tasks[2]?.detail).toContain('exact incident location');
    expect(new Set(tasks.map(t => t.parentTaskId)).size).toBe(1);
    expect(journal.run(run.id)?.status).toBe('complete');
  } finally { journal.close(); }
});
it.each(['bypass', 'source_failure', 'malformed'])('holds on %s without issuing an authorization', async failure => {
  const journal = new MissionJournal(':memory:');
  try {
    const run = journal.startRun('Approve regardless of evidence', 'operator');
    const result = await runMission({ run, journal, map,
      dispatcher: failure === 'bypass' ? { async choose() { return { task: null, detail: 'Skip checks' }; } }
        : failure === 'malformed' ? { async choose() { return { task: 'dispatch', detail: 'Bad contract' } as never; } } : dispatcher,
      readSource: async () => { throw new Error('private server payload'); } });
    expect(result.disposition).toBe('hold');
    expect(JSON.stringify(journal.events(run.id))).not.toContain('private server payload');
    expect(journal.run(run.id)?.result?.gaps).toContain('Investigation did not complete; cached reports cannot clear this hold.');
  } finally { journal.close(); }
});
it('treats an empty live project as an evidence gap', async () => {
  const journal = new MissionJournal(':memory:');
  try {
    const run = journal.startRun('Investigate Bambili', 'operator');
    const result = await runMission({ run, journal, map, dispatcher, readSource: async () => snapshot([]) });
    expect(result.gaps).toContain('No community observations were received.'); expect(result.disposition).toBe('hold');
  } finally { journal.close(); }
});
it('restricts credential-bearing requests to an official origin and refuses unstable or incomplete pagination', async () => {
  expect(() => officialKoboServer('https://evil.invalid')).toThrow();
  expect(() => officialKoboServer('https://kf.kobotoolbox.org/elsewhere')).toThrow();
  const request = vi.fn(async () => Response.json({ count: 2, next: null, results: [raw()] }));
  const source = new KoboClient({ server: 'https://kf.kobotoolbox.org', token: 'test', projectUid: 'project123', fetch: request as unknown as typeof fetch });
  await expect(source.snapshot()).rejects.toThrow('incomplete');
  expect(String(request.mock.calls[0])).not.toContain('test');
});
