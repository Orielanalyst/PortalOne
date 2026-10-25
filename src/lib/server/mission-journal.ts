import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CommunitySignal, KoboSnapshot } from './kobo';
import type { FederatedEvidence } from './community-evidence';
import type { LogisticsAdvice } from './mission-logistics';

export type MissionEvent = { seq: number; runId: string; taskId: string | null; parentTaskId: string | null;
  actor: string; kind: string; detail: string; evidenceIds: string[]; at: string };
export type MissionResult = { disposition: 'hold'; summary: string; gaps: string[]; signalIds: string[];
  placeIds: string[]; demoReports: number; liveReports: number; assessmentId?: string };
export type PlanningAssessment = { id: string; runId: string; status: 'draft' | 'checked' | 'invalidated';
  evidence: FederatedEvidence; advice: LogisticsAdvice; createdAt: string; reason: string | null };
export type JournalRun = { id: string; sessionId: string; message: string; cause: string; status: 'running' | 'complete' | 'interrupted';
  startedAt: string; finishedAt: string | null; result: MissionResult | null };
export class MissionJournal {
  private readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=2500;
      CREATE TABLE IF NOT EXISTS signals(id TEXT PRIMARY KEY, source_key TEXT NOT NULL, source_id TEXT NOT NULL,
        normalized TEXT NOT NULL, raw TEXT NOT NULL, received_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS signal_heads(source_key TEXT PRIMARY KEY, signal_id TEXT NOT NULL REFERENCES signals(id));
      CREATE TABLE IF NOT EXISTS polls(source_id TEXT PRIMARY KEY, checked_at TEXT NOT NULL, count INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, session_id TEXT NOT NULL, message TEXT NOT NULL, cause TEXT NOT NULL,
        status TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, result TEXT);
      CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id),
        task_id TEXT, parent_task_id TEXT, actor TEXT NOT NULL, kind TEXT NOT NULL, detail TEXT NOT NULL, evidence_ids TEXT NOT NULL, at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id), parent_id TEXT,
        agent TEXT NOT NULL, goal TEXT NOT NULL, status TEXT NOT NULL, result TEXT);
      CREATE INDEX IF NOT EXISTS events_run ON events(run_id, seq);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS assessments(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES runs(id),
      source_id TEXT NOT NULL,input_revision TEXT NOT NULL,revision TEXT NOT NULL,status TEXT NOT NULL,
      evidence TEXT NOT NULL,advice TEXT NOT NULL,created_at TEXT NOT NULL,reason TEXT);
      CREATE INDEX IF NOT EXISTS assessments_source ON assessments(source_id,status);`);
  }
  close() { this.db.close(); }
  ingest(snapshot: KoboSnapshot) {
    const changed: string[] = [];
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const { signal, raw } of snapshot.records) {
        const old = this.db.prepare('SELECT signal_id FROM signal_heads WHERE source_key=?').get(signal.sourceKey) as { signal_id: string } | undefined;
        this.db.prepare('INSERT OR IGNORE INTO signals VALUES(?,?,?,?,?,?)').run(signal.id, signal.sourceKey, snapshot.sourceId,
          JSON.stringify(signal), JSON.stringify(raw), signal.receivedAt);
        if (old?.signal_id !== signal.id) {
          this.db.prepare('INSERT INTO signal_heads VALUES(?,?) ON CONFLICT(source_key) DO UPDATE SET signal_id=excluded.signal_id').run(signal.sourceKey, signal.id);
          changed.push(signal.id);
        }
      }
      // Missing records are not silently deleted: Kobo pagination is not a transactional snapshot.
      this.db.prepare('INSERT INTO polls VALUES(?,?,?) ON CONFLICT(source_id) DO UPDATE SET checked_at=excluded.checked_at,count=excluded.count')
        .run(snapshot.sourceId, snapshot.checkedAt, snapshot.count);
      this.db.exec('COMMIT'); return { changed, retained: this.signals().length };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  signals(): CommunitySignal[] {
    return this.db.prepare('SELECT s.normalized FROM signals s JOIN signal_heads h ON s.id=h.signal_id ORDER BY s.received_at DESC,s.id')
      .all().map(row => JSON.parse(row['normalized'] as string) as CommunitySignal);
  }
  signalsByIds(ids: string[]): CommunitySignal[] {
    const read = this.db.prepare('SELECT normalized FROM signals WHERE id=?');
    return ids.flatMap(id => { const row = read.get(id); return row ? [JSON.parse(row['normalized'] as string) as CommunitySignal] : []; });
  }
  currentSignals(snapshot: KoboSnapshot): CommunitySignal[] {
    const ids = new Set(snapshot.records.map(r => r.signal.id));
    return this.signals().filter(s => ids.has(s.id));
  }
  startRun(message: string, cause: string, sessionId = `session-${randomUUID()}`) {
    const id = `mission-${randomUUID()}`;
    this.db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?,?,?)').run(id, sessionId, message, cause, 'running', new Date().toISOString(), null, null);
    return this.run(id)!;
  }
  event(runId: string, actor: string, kind: string, detail: string, evidenceIds: string[] = [], taskId: string | null = null, parentTaskId: string | null = null) {
    this.db.prepare('INSERT INTO events(run_id,task_id,parent_task_id,actor,kind,detail,evidence_ids,at) VALUES(?,?,?,?,?,?,?,?)')
      .run(runId, taskId, parentTaskId, actor, kind, detail, JSON.stringify(evidenceIds), new Date().toISOString());
  }
  events(runId: string): MissionEvent[] {
    return this.db.prepare('SELECT * FROM events WHERE run_id=? ORDER BY seq').all(runId).map(row => ({
      seq: row['seq'] as number, runId, taskId: row['task_id'] as string | null, parentTaskId: row['parent_task_id'] as string | null,
      actor: row['actor'] as string, kind: row['kind'] as string, detail: row['detail'] as string,
      evidenceIds: JSON.parse(row['evidence_ids'] as string), at: row['at'] as string }));
  }
  startTask(runId: string, parentId: string | null, agent: string, goal: string, eventKind = 'task_started') {
    const id = `task-${randomUUID()}`;
    this.db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?,?,?)').run(id, runId, parentId, agent, goal, 'running', null);
    this.event(runId, agent, eventKind, goal, [], id, parentId); return id;
  }
  finishTask(id: string, result: unknown) { this.db.prepare("UPDATE tasks SET status='complete',result=? WHERE id=?").run(JSON.stringify(result), id); }
  observeEvidence(evidence: FederatedEvidence) {
    const affected = this.db.prepare("SELECT id,run_id FROM assessments WHERE source_id=? AND revision<>? AND status<>'invalidated'").all(evidence.sourceId, evidence.revision);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const row of affected) {
        this.db.prepare("UPDATE assessments SET status='invalidated',reason=? WHERE id=?").run('Federated community evidence or logistics changed; fresh review required.', row['id'] as string);
        this.event(row['run_id'] as string, 'checker', 'assessment_invalidated', 'This planning assessment is superseded by changed federated evidence. Fresh review is required.', [row['id'] as string]);
      }
      this.db.exec('COMMIT'); return affected.map(row => row['id'] as string);
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  recordAssessment(runId: string, evidence: FederatedEvidence, advice: LogisticsAdvice) {
    this.observeEvidence(evidence);
    const id = `assessment-${randomUUID()}`;
    this.db.prepare('INSERT INTO assessments VALUES(?,?,?,?,?,?,?,?,?,?)').run(id, runId, evidence.sourceId, evidence.inputRevision,
      evidence.revision, 'draft', JSON.stringify(evidence), JSON.stringify(advice), new Date().toISOString(), null);
    return id;
  }
  checkAssessment(id: string, evidence: FederatedEvidence) {
    this.observeEvidence(evidence);
    const updated = this.db.prepare("UPDATE assessments SET status='checked' WHERE id=? AND revision=? AND status='draft'").run(id, evidence.revision);
    return Number(updated.changes) === 1;
  }
  assessments(runId: string): PlanningAssessment[] {
    return this.db.prepare('SELECT * FROM assessments WHERE run_id=? ORDER BY created_at,id').all(runId).map(row => ({
      id: row['id'] as string, runId, status: row['status'] as PlanningAssessment['status'], evidence: JSON.parse(row['evidence'] as string),
      advice: JSON.parse(row['advice'] as string), createdAt: row['created_at'] as string, reason: row['reason'] as string | null }));
  }
  failOpenChildren(runId: string) {
    this.db.prepare("UPDATE assessments SET status='invalidated',reason='Investigation failed before independent review.' WHERE run_id=? AND status='draft'").run(runId);
    const tasks = this.db.prepare("SELECT id,parent_id,agent FROM tasks WHERE run_id=? AND parent_id IS NOT NULL AND status='running'").all(runId);
    for (const task of tasks) {
      this.db.prepare("UPDATE tasks SET status='failed' WHERE id=?").run(task['id'] as string);
      this.event(runId, task['agent'] as string, 'task_failed', 'The specialist did not complete; no evidence clearance was issued.', [], task['id'] as string, task['parent_id'] as string);
    }
  }
  finish(runId: string, result: MissionResult) {
    this.db.prepare("UPDATE runs SET status='complete',finished_at=?,result=? WHERE id=? AND status='running'")
      .run(new Date().toISOString(), JSON.stringify(result), runId);
  }
  interrupt(runId: string) {
    this.db.prepare("UPDATE assessments SET status='invalidated',reason='Investigation interrupted; fresh review required.' WHERE run_id=? AND status='draft'").run(runId);
    this.db.prepare("UPDATE runs SET status='interrupted',finished_at=? WHERE id=? AND status='running'").run(new Date().toISOString(), runId);
    this.db.prepare("UPDATE tasks SET status='interrupted' WHERE run_id=? AND status='running'").run(runId);
  }
  run(id: string): JournalRun | null {
    const row = this.db.prepare('SELECT * FROM runs WHERE id=?').get(id);
    return row ? { id, sessionId: row['session_id'] as string, message: row['message'] as string, cause: row['cause'] as string,
      status: row['status'] as JournalRun['status'], startedAt: row['started_at'] as string, finishedAt: row['finished_at'] as string | null,
      result: row['result'] ? JSON.parse(row['result'] as string) : null } : null;
  }
  recent(): JournalRun[] {
    return this.db.prepare('SELECT id FROM runs ORDER BY started_at DESC LIMIT 20').all().map(row => this.run(row['id'] as string)!);
  }
}
