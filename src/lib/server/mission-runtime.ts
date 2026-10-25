import { MissionJournal } from './mission-journal';
import { CommunityMap } from './community-map';
import { configuredKobo } from './kobo';
import { configuredNightshift } from './runtime-config';
import { NightshiftDispatcher, runMission } from './mission-coordinator';
import type { JournalRun } from './mission-journal';
import { replayCommunitySource, replayDispatcher } from './mission-replay';

/** One local application process owns this journal and its bounded monitoring loop. */
class MissionRuntime {
  readonly mode = process.env['RELIEFINTEL_MODE'] === 'offline-replay' ? 'offline-replay' : 'live';
  readonly journal = new MissionJournal(`.runtime/${this.mode === 'live' ? 'mission' : 'mission-replay'}/journal.sqlite`);
  readonly map = new CommunityMap();
  private readonly source = this.mode === 'live' ? configuredKobo() : replayCommunitySource;
  private active: string | null = null;
  private monitor: { sessionId: string; message: string; until: number } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sourceStatus: 'unchecked' | 'online' | 'unavailable' = 'unchecked';
  private checkedAt: string | null = null;
  private polling = false;
  constructor() {
    if (process.env['RELIEFINTEL_MODE'] && !['live', 'offline-replay'].includes(process.env['RELIEFINTEL_MODE'])) throw new Error('Unsupported ReliefIntel runtime mode.');
    // No implicit dispatch/replay on restart. Persisted partial runs remain inspectable.
    for (const run of this.journal.recent()) if (run.status === 'running') {
      this.journal.event(run.id, 'runtime', 'interrupted', 'Application restarted; this investigation was interrupted. Start a fresh check.');
      this.journal.interrupt(run.id);
    }
  }
  start(message: string, watchMinutes: number, cause = 'operator', sessionId?: string) {
    if (this.active) throw new Error('An investigation is already running.');
    const client = this.mode === 'live' ? configuredNightshift() : null;
    const run = this.journal.startRun(message, cause, sessionId);
    this.active = run.id;
    if (cause === 'operator') {
      this.stopMonitor();
      if (watchMinutes && this.mode === 'live') this.monitor = { sessionId: run.sessionId, message, until: Date.now() + watchMinutes * 60_000 };
    }
    const dispatcher = client ? new NightshiftDispatcher(client, receipt => this.journal.event(run.id, 'coordinator', 'model_receipt', receipt)) : replayDispatcher;
    void runMission({ run, journal: this.journal, map: this.map, dispatcher, readSource: async signal => {
      try { const snapshot = await this.source.snapshot(signal); this.sourceStatus = 'online'; this.checkedAt = snapshot.checkedAt; return snapshot; }
      catch (error) { this.sourceStatus = 'unavailable'; this.checkedAt = new Date().toISOString(); throw error; }
    } }).catch(() => this.journal.interrupt(run.id)).finally(() => { this.active = null; this.schedule(); });
    return run.id;
  }
  stopMonitor() { this.monitor = null; if (this.timer) clearTimeout(this.timer); this.timer = null; }
  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    if (!this.monitor || Date.now() >= this.monitor.until) { this.stopMonitor(); return; }
    this.timer = setTimeout(() => { this.timer = null; void this.poll(); }, 20_000);
    this.timer.unref?.();
  }
  private async poll() {
    if (!this.monitor || Date.now() >= this.monitor.until) { this.stopMonitor(); return; }
    if (this.active || this.polling) { this.schedule(); return; }
    this.polling = true;
    try {
      const snapshot = await this.source.snapshot();
      const previousStatus = this.sourceStatus;
      this.sourceStatus = 'online'; this.checkedAt = snapshot.checkedAt;
      const intake = this.journal.ingest(snapshot);
      if (intake.changed.length || previousStatus === 'unavailable') {
        const runId = this.start(this.monitor.message, 0, previousStatus === 'unavailable' ? 'source_recovered' : 'source_change', this.monitor.sessionId);
        this.journal.event(runId, 'intake', 'source_change', `${intake.changed.length} new or edited report versions triggered this investigation.`, intake.changed);
      }
    } catch {
      const latest = this.journal.recent()[0];
      if (latest && this.sourceStatus !== 'unavailable') this.journal.event(latest.id, 'intake', 'source_unavailable', 'Kobo polling failed. Cached reports are not current source confirmation.');
      this.sourceStatus = 'unavailable'; this.checkedAt = new Date().toISOString();
    } finally { this.polling = false; this.schedule(); }
  }
  state(selectedId?: string) {
    const runs = this.journal.recent();
    const selected: JournalRun | null = selectedId ? this.journal.run(selectedId) : runs[0] ?? null;
    const signals = selected?.result ? this.journal.signalsByIds(selected.result.signalIds) : this.journal.signals();
    return { mode: this.mode, runs, selected, events: selected ? this.journal.events(selected.id) : [], activeRunId: this.active,
      sourceStatus: this.sourceStatus, checkedAt: this.checkedAt,
      monitorUntil: this.monitor && this.monitor.until > Date.now() ? new Date(this.monitor.until).toISOString() : null,
      signals: signals.map(({ claimedOrigin: _privateOrigin, contentFingerprint: _fingerprint, location: _privateGps, ...signal }) => signal),
      groundings: signals.map(s => this.map.resolve(s)),
      map: { version: this.map.manifest.version, bounds: this.map.manifest.bounds, attribution: this.map.manifest.attribution,
        limits: this.map.manifest.limits, places: this.map.places },
      projectUrl: this.source.origin ? `${this.source.origin}/#/forms/${process.env['KOBO_PROJECT_UID']}/summary` : null };
  }
}
const shared = globalThis as typeof globalThis & { __reliefMissionRuntime?: MissionRuntime };
export function missionRuntime() { return shared.__reliefMissionRuntime ??= new MissionRuntime(); }
export type MissionView = ReturnType<MissionRuntime['state']>;

export function requireLocalRequest(request: Request, write = false) {
  const url = new URL(request.url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Local operator interface only.');
  if (write && (request.headers.get('origin') !== url.origin || !request.headers.get('content-type')?.startsWith('application/json'))) throw new Error('Use the local operator interface.');
}
