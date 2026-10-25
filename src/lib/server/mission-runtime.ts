import { MissionJournal } from './mission-journal';
import { CommunityMap } from './community-map';
import { configuredKobo } from './kobo';
import { configuredNightshift } from './runtime-config';
import { NightshiftDispatcher, runMission } from './mission-coordinator';
import type { JournalRun } from './mission-journal';
import type { KoboSnapshot } from './kobo';
import type { MissionDispatcher } from './mission-coordinator';
import { replayCommunitySource, replayDispatcher } from './mission-replay';
import { FixtureCommunityEvidence, ZetarisCommunityEvidence } from './community-evidence';
import type { MissionEvidence } from './community-evidence';
import { FixtureMissionLogistics, NightshiftMissionLogistics } from './mission-logistics';
import type { MissionLogistics } from './mission-logistics';
import { execFileSync } from 'node:child_process';

function sourceRevision() {
  try {
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 3000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return /^[a-f0-9]{40}$/.test(revision) ? revision : null;
  } catch { return null; }
}

/** One local application process owns this journal and its bounded monitoring loop. */
export class MissionRuntime {
  readonly applicationSourceCommit = sourceRevision();
  readonly mode = process.env['RELIEFINTEL_MODE'] === 'offline-replay' ? 'offline-replay' : 'live';
  readonly journal: MissionJournal;
  readonly map = new CommunityMap();
  private readonly source: { origin: string | null; snapshot(signal?: AbortSignal): Promise<KoboSnapshot> };
  private readonly evidence: MissionEvidence;
  private active: string | null = null;
  private monitor: { sessionId: string; message: string; until: number; lastRevision?: string; autoRuns: number } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sourceStatus: 'unchecked' | 'online' | 'unavailable' = 'unchecked';
  private checkedAt: string | null = null;
  private polling = false;
  private federationStatus: 'unchecked' | 'online' | 'unavailable' = 'unchecked';
  constructor(private readonly options: { journal?: MissionJournal; source?: { origin: string | null; snapshot(signal?: AbortSignal): Promise<KoboSnapshot> };
    dispatcher?: MissionDispatcher; pollIntervalMs?: number; evidence?: MissionEvidence; logistics?: MissionLogistics } = {}) {
    if (process.env['RELIEFINTEL_MODE'] && !['live', 'offline-replay'].includes(process.env['RELIEFINTEL_MODE'])) throw new Error('Unsupported ReliefIntel runtime mode.');
    this.journal = options.journal ?? new MissionJournal(`.runtime/${this.mode === 'live' ? 'mission' : 'mission-replay'}/journal.sqlite`);
    this.source = options.source ?? (this.mode === 'live' ? configuredKobo() : replayCommunitySource);
    this.evidence = options.evidence ?? (this.mode === 'live' ? new ZetarisCommunityEvidence(this.map) : new FixtureCommunityEvidence(this.map));
    // No implicit dispatch/replay on restart. Persisted partial runs remain inspectable.
    for (const run of this.journal.recent()) if (run.status === 'running') {
      this.journal.event(run.id, 'runtime', 'interrupted', 'Application restarted; this investigation was interrupted. Start a fresh check.');
      this.journal.interrupt(run.id);
    }
  }
  start(message: string, watchMinutes: number, cause = 'operator', sessionId?: string) {
    if (this.active) throw new Error('An investigation is already running.');
    const client = this.mode === 'live' && !this.options.dispatcher ? configuredNightshift() : null;
    const run = this.journal.startRun(message, cause, sessionId);
    this.active = run.id;
    if (cause === 'operator') {
      this.stopMonitor();
      if (watchMinutes && this.mode === 'live') this.monitor = { sessionId: run.sessionId, message, until: Date.now() + watchMinutes * 60_000, autoRuns: 0 };
    }
    const dispatcher = this.options.dispatcher ?? (client ? new NightshiftDispatcher(client, receipt => this.journal.event(run.id, 'coordinator', 'model_receipt', receipt)) : replayDispatcher);
    const logistics = this.options.logistics ?? (client ? new NightshiftMissionLogistics(client) : new FixtureMissionLogistics());
    void runMission({ run, journal: this.journal, map: this.map, dispatcher, logistics, evidence: { load: async (snapshot, signal) => {
      try { const context = await this.evidence.load(snapshot, signal); this.federationStatus = 'online'; return context; }
      catch (error) { this.federationStatus = 'unavailable'; throw error; }
    } }, readSource: async signal => {
      try { const snapshot = await this.source.snapshot(signal); this.sourceStatus = 'online'; this.checkedAt = snapshot.checkedAt; return snapshot; }
      catch (error) { this.sourceStatus = 'unavailable'; this.checkedAt = new Date().toISOString(); throw error; }
    } }).then(result => {
      const assessment = this.journal.assessments(run.id).find(a => a.id === result.assessmentId);
      if (assessment?.status === 'checked' && this.monitor?.sessionId === run.sessionId) this.monitor.lastRevision = assessment.evidence.revision;
    }).catch(() => this.journal.interrupt(run.id)).finally(() => { this.active = null; this.schedule(); });
    return run.id;
  }
  stopMonitor() { this.monitor = null; if (this.timer) clearTimeout(this.timer); this.timer = null; }
  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    if (!this.monitor || Date.now() >= this.monitor.until) { this.stopMonitor(); return; }
    this.timer = setTimeout(() => { this.timer = null; void this.poll(); }, this.options.pollIntervalMs ?? 20_000);
    this.timer.unref?.();
  }
  private async poll() {
    if (!this.monitor || Date.now() >= this.monitor.until) { this.stopMonitor(); return; }
    if (this.active || this.polling) { this.schedule(); return; }
    const watching = this.monitor;
    this.polling = true;
    let koboRead = false;
    try {
      const signal = AbortSignal.timeout(Math.max(1, Math.min(30_000, watching.until - Date.now())));
      const snapshot = await this.source.snapshot(signal);
      koboRead = true;
      if (this.monitor !== watching) return;
      if (Date.now() >= watching.until) { this.stopMonitor(); return; }
      const context = await this.evidence.load(snapshot, signal);
      if (this.monitor !== watching) return;
      if (Date.now() >= watching.until) { this.stopMonitor(); return; }
      const previousStatus = this.sourceStatus;
      const previousFederationStatus = this.federationStatus;
      this.sourceStatus = 'online'; this.checkedAt = snapshot.checkedAt;
      this.federationStatus = 'online';
      const intake = this.journal.ingest(snapshot);
      this.journal.observeEvidence(context);
      if (intake.changed.length || watching.lastRevision !== context.revision || previousStatus === 'unavailable' || previousFederationStatus === 'unavailable') {
        if (watching.autoRuns >= 6) {
          const latest = this.journal.recent()[0]; if (latest) this.journal.event(latest.id, 'runtime', 'watch_budget_exhausted', 'Automatic investigation budget reached. Evidence is superseded; an operator must start a fresh watch.');
          this.stopMonitor(); return;
        }
        watching.autoRuns++; watching.lastRevision = context.revision;
        const runId = this.start(watching.message, 0, previousStatus === 'unavailable' || previousFederationStatus === 'unavailable' ? 'source_recovered' : 'source_change', watching.sessionId);
        this.journal.event(runId, 'intake', 'source_change', `${intake.changed.length} new or edited report versions triggered this investigation.`, intake.changed);
      }
    } catch {
      if (this.monitor !== watching) return;
      if (Date.now() >= watching.until) { this.stopMonitor(); return; }
      const latest = this.journal.recent()[0];
      if (latest && (this.sourceStatus !== 'unavailable' && this.federationStatus !== 'unavailable')) this.journal.event(latest.id, 'intake', 'source_unavailable', 'Community source or federation refresh failed. Cached context is not current confirmation.');
      this.sourceStatus = koboRead ? 'online' : 'unavailable';
      if (koboRead) this.federationStatus = 'unavailable';
      this.checkedAt = new Date().toISOString();
    } finally { this.polling = false; this.schedule(); }
  }
  state(selectedId?: string) {
    const runs = this.journal.recent();
    const selected: JournalRun | null = selectedId ? this.journal.run(selectedId) : runs[0] ?? null;
    const signals = selected?.result ? this.journal.signalsByIds(selected.result.signalIds) : this.journal.signals();
    return { mode: this.mode, applicationSourceCommit: this.applicationSourceCommit, runs, selected, events: selected ? this.journal.events(selected.id) : [], activeRunId: this.active,
      sourceStatus: this.sourceStatus, federationStatus: this.federationStatus, checkedAt: this.checkedAt,
      assessments: selected ? this.journal.assessments(selected.id) : [],
      assessmentStatuses: Object.fromEntries(runs.map(r => [r.id, this.journal.assessments(r.id).at(-1)?.status ?? null])),
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
