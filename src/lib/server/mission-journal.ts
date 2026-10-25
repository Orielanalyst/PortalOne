import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CommunitySignal, KoboSnapshot } from './kobo';
import type { FederatedEvidence } from './community-evidence';
import type { LogisticsAdvice } from './mission-logistics';
import type { ConversationReceipt } from './mission-conversation';

export type MissionEvent = { seq: number; runId: string; taskId: string | null; parentTaskId: string | null;
  actor: string; kind: string; detail: string; evidenceIds: string[]; at: string };
export type MissionResult = { disposition: 'hold'; summary: string; gaps: string[]; signalIds: string[];
  placeIds: string[]; demoReports: number; liveReports: number; assessmentId?: string };
export type PlanningAssessment = { id: string; runId: string; status: 'draft' | 'checked' | 'invalidated';
  evidence: FederatedEvidence; advice: LogisticsAdvice; createdAt: string; reason: string | null;
  checks: { id: string; matched: boolean; evidence: FederatedEvidence; at: string }[] };
export type JournalRun = { id: string; sessionId: string; message: string; cause: string; status: 'running' | 'complete' | 'interrupted';
  startedAt: string; finishedAt: string | null; result: MissionResult | null };
export type ConversationTurn = { id: string; sessionId: string; message: string; reply: string | null;
  mode: 'live-model' | 'offline-replay'; status: 'pending' | 'replied' | 'failed'; action: 'reply' | 'investigate' | null;
  runId: string | null; createdAt: string; receipt: ConversationReceipt | null };
export type ConversationSummary = { runId: string; status: 'pending' | 'complete' | 'failed'; reply: string | null; receipt: ConversationReceipt | null };
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
    this.db.exec(`CREATE TABLE IF NOT EXISTS assessment_checks(id TEXT PRIMARY KEY,assessment_id TEXT NOT NULL REFERENCES assessments(id),
      matched INTEGER NOT NULL,evidence TEXT NOT NULL,checked_at TEXT NOT NULL);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS conversation_turns(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,
      message TEXT NOT NULL,reply TEXT,mode TEXT NOT NULL,status TEXT NOT NULL,action TEXT,run_id TEXT REFERENCES runs(id),
      created_at TEXT NOT NULL,receipt TEXT);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS conversation_summaries(run_id TEXT PRIMARY KEY REFERENCES runs(id),
      status TEXT NOT NULL,reply TEXT,receipt TEXT);`);
  }
  close() { this.db.close(); }
  beginConversation(message: string, mode: ConversationTurn['mode']) {
    const previous = this.conversation().at(-1);
    const id = `turn-${randomUUID()}`, sessionId = previous?.sessionId ?? `session-${randomUUID()}`;
    this.db.prepare('INSERT INTO conversation_turns VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run(id, sessionId, message, null, mode, 'pending', null, null, new Date().toISOString(), null);
    return this.conversation().find(turn => turn.id === id)!;
  }
  conversationReceipt(id: string, receipt: ConversationReceipt) {
    this.db.prepare("UPDATE conversation_turns SET receipt=? WHERE id=? AND status='pending'").run(JSON.stringify(receipt), id);
  }
  finishConversation(id: string, reply: string, action: ConversationTurn['action'], runId: string | null = null, failed = false) {
    this.db.prepare("UPDATE conversation_turns SET reply=?,action=?,run_id=?,status=? WHERE id=? AND status='pending'")
      .run(reply, action, runId, failed ? 'failed' : 'replied', id);
  }
  interruptConversations() {
    this.db.prepare("UPDATE conversation_turns SET status='failed',reply='The application restarted before the coordinator reply completed. Check the investigation history before trying again.' WHERE status='pending'").run();
    this.db.prepare("UPDATE conversation_summaries SET status='failed',reply='The application restarted before the conversational summary completed. The structured investigation result remains available.' WHERE status='pending'").run();
  }
  beginConversationSummary(runId: string) {
    this.db.prepare("INSERT INTO conversation_summaries VALUES(?,'pending',NULL,NULL)").run(runId);
  }
  finishConversationSummary(runId: string, reply: string, receipt: ConversationReceipt | null) {
    this.db.prepare("UPDATE conversation_summaries SET status=?,reply=?,receipt=? WHERE run_id=? AND status='pending'")
      .run(receipt ? 'complete' : 'failed', reply, receipt ? JSON.stringify(receipt) : null, runId);
  }
  conversationSummaries(): ConversationSummary[] {
    return this.db.prepare('SELECT * FROM conversation_summaries ORDER BY rowid DESC LIMIT 20').all().map(row => ({
      runId: row['run_id'] as string, status: row['status'] as ConversationSummary['status'], reply: row['reply'] as string | null,
      receipt: row['receipt'] ? JSON.parse(row['receipt'] as string) : null,
    }));
  }
  conversation(): ConversationTurn[] {
    return this.db.prepare('SELECT * FROM conversation_turns ORDER BY rowid DESC LIMIT 20').all().reverse().map(row => ({
      id: row['id'] as string, sessionId: row['session_id'] as string, message: row['message'] as string,
      reply: row['reply'] as string | null, mode: row['mode'] as ConversationTurn['mode'], status: row['status'] as ConversationTurn['status'],
      action: row['action'] as ConversationTurn['action'], runId: row['run_id'] as string | null,
      createdAt: row['created_at'] as string, receipt: row['receipt'] ? JSON.parse(row['receipt'] as string) : null,
    }));
  }
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
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const updated = this.db.prepare("UPDATE assessments SET status='checked' WHERE id=? AND revision=? AND status='draft'").run(id, evidence.revision);
      const matched = Number(updated.changes) === 1;
      this.db.prepare('INSERT INTO assessment_checks VALUES(?,?,?,?,?)').run(`check-${randomUUID()}`, id, matched ? 1 : 0, JSON.stringify(evidence), new Date().toISOString());
      this.db.exec('COMMIT'); return matched;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  assessments(runId: string): PlanningAssessment[] {
    return this.db.prepare('SELECT * FROM assessments WHERE run_id=? ORDER BY rowid').all(runId).map(row => ({
      id: row['id'] as string, runId, status: row['status'] as PlanningAssessment['status'], evidence: JSON.parse(row['evidence'] as string),
      advice: JSON.parse(row['advice'] as string), createdAt: row['created_at'] as string, reason: row['reason'] as string | null,
      checks: this.db.prepare('SELECT * FROM assessment_checks WHERE assessment_id=? ORDER BY rowid').all(row['id'] as string).map(check => ({
        id: check['id'] as string, matched: check['matched'] === 1, evidence: JSON.parse(check['evidence'] as string), at: check['checked_at'] as string })) }));
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
