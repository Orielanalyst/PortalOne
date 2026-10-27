import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CommunitySignal, KoboSnapshot } from './kobo';
import type { FederatedEvidence } from './community-evidence';
import type { LogisticsAdvice } from './mission-logistics';
import type { ConversationReceipt } from './mission-conversation';
import type { EvidenceCitation, MissionDocument, ReportBundle, JournalChange } from '../mission-artifacts';
import type { Interpretation } from './signal-interpretation';
import {applyMissionPatch} from './mission-requirements';
import type {MissionRequirements,UserInputSource} from './mission-requirements';
import type {MissionFeasibility} from './mission-feasibility';
import type {OperatorReview} from './mission-review';
import type {RejectedConversationAttempt} from './mission-conversation';
import type {AreaMapJob} from '../area-geography';

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
  mode: 'live-model' | 'offline-replay'; status: 'pending' | 'replied' | 'failed'; action: 'reply' | 'investigate' | 'map_area' | null;
  runId: string | null; createdAt: string; receipt: ConversationReceipt | null };
export type ConversationSummary = { runId: string; status: 'pending' | 'complete' | 'failed'; reply: string | null; receipt: ConversationReceipt | null };
export type MissionSession = { id: string; title: string; createdAt: string; updatedAt: string; runCount: number; turnCount: number };
export class MissionJournal {
  private readonly db: DatabaseSync;
  private readonly listeners = new Set<(change: JournalChange) => void>();
  subscribe(listener: (change: JournalChange) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  changed(change: JournalChange = { type: 'state' }) { for (const listener of this.listeners) { try { listener(change); } catch { /* a disconnected viewer cannot fail a mission */ } } }
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
    this.db.exec(`CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,run_id TEXT REFERENCES runs(id),turn_id TEXT,
      task_id TEXT,actor TEXT NOT NULL,kind TEXT NOT NULL,title TEXT NOT NULL,version INTEGER NOT NULL,
      status TEXT NOT NULL,markdown TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,metadata TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS citations(run_id TEXT NOT NULL REFERENCES runs(id),id TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(run_id,id));
      CREATE TABLE IF NOT EXISTS report_bundles(run_id TEXT PRIMARY KEY REFERENCES runs(id),value TEXT NOT NULL);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS mission_replacements(previous_run_id TEXT PRIMARY KEY REFERENCES runs(id),
      next_run_id TEXT NOT NULL UNIQUE REFERENCES runs(id),created_at TEXT NOT NULL);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS signal_interpretations(id TEXT PRIMARY KEY,cache_key TEXT NOT NULL,
      run_id TEXT NOT NULL REFERENCES runs(id),signal_id TEXT NOT NULL REFERENCES signals(id),status TEXT NOT NULL,value TEXT NOT NULL,
      UNIQUE(run_id,signal_id)); CREATE INDEX IF NOT EXISTS interpretation_cache ON signal_interpretations(cache_key,status);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS mission_requirements(session_id TEXT NOT NULL,version INTEGER NOT NULL,value TEXT NOT NULL,
      PRIMARY KEY(session_id,version)); CREATE TABLE IF NOT EXISTS mission_run_inputs(run_id TEXT PRIMARY KEY REFERENCES runs(id),value TEXT NOT NULL);`);
    this.db.exec('CREATE TABLE IF NOT EXISTS mission_calculations(run_id TEXT PRIMARY KEY REFERENCES runs(id),value TEXT NOT NULL)');
    this.db.exec(`CREATE TABLE IF NOT EXISTS operator_reviews(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES runs(id),plan_id TEXT NOT NULL,
      status TEXT NOT NULL,reason TEXT,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS review_revisions(review_id TEXT PRIMARY KEY REFERENCES operator_reviews(id),
      next_run_id TEXT NOT NULL UNIQUE REFERENCES runs(id));`);
    this.db.exec('CREATE TABLE IF NOT EXISTS conversation_attempts(id TEXT PRIMARY KEY,turn_id TEXT NOT NULL,value TEXT NOT NULL)');
    this.db.exec('CREATE TABLE IF NOT EXISTS area_map_jobs(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,value TEXT NOT NULL)');
    this.db.exec(`CREATE TABLE IF NOT EXISTS mission_sessions(id TEXT PRIMARY KEY,title TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS conversation_session ON conversation_turns(session_id);
      CREATE INDEX IF NOT EXISTS runs_session ON runs(session_id);`);
    // Add metadata around legacy histories; never delete or reassign their turns/runs.
    const legacy=this.db.prepare(`SELECT session_id,message,created_at AS at FROM conversation_turns
      UNION ALL SELECT session_id,message,started_at AS at FROM runs ORDER BY at ASC`).all();
    const insert=this.db.prepare('INSERT OR IGNORE INTO mission_sessions VALUES(?,?,?,?)');
    const latest=this.db.prepare('UPDATE mission_sessions SET updated_at=MAX(updated_at,?) WHERE id=?');
    for(const row of legacy){insert.run(row['session_id'] as string,String(row['message']).replace(/\s+/g,' ').slice(0,80),row['at'] as string,row['at'] as string);latest.run(row['at'] as string,row['session_id'] as string);}
  }
  session(id:string):MissionSession|null {
    const row=this.db.prepare(`SELECT s.*,(SELECT COUNT(*) FROM runs r WHERE r.session_id=s.id) AS run_count,
      (SELECT COUNT(*) FROM conversation_turns t WHERE t.session_id=s.id) AS turn_count FROM mission_sessions s WHERE s.id=?`).get(id);
    return row?{id:row['id'] as string,title:row['title'] as string,createdAt:row['created_at'] as string,updatedAt:row['updated_at'] as string,
      runCount:row['run_count'] as number,turnCount:row['turn_count'] as number}:null;
  }
  saveAreaMap(job:AreaMapJob){this.db.prepare('INSERT INTO area_map_jobs VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(job.id,job.sessionId,JSON.stringify(job));this.changed();}
  areaMaps(sessionId:string):AreaMapJob[]{return this.db.prepare('SELECT value FROM area_map_jobs WHERE session_id=? ORDER BY rowid DESC LIMIT 12').all(sessionId).map(row=>JSON.parse(row['value'] as string));}
  areaMap(id:string):AreaMapJob|null{const row=this.db.prepare('SELECT value FROM area_map_jobs WHERE id=?').get(id);return row?JSON.parse(row['value'] as string):null;}
  interruptAreaMaps(){for(const row of this.db.prepare('SELECT value FROM area_map_jobs').all()){const job=JSON.parse(row['value'] as string) as AreaMapJob;if(job.status==='building'){job.status='failed';job.error='The map build was interrupted by a restart. Select the area again to rebuild.';job.updatedAt=new Date().toISOString();this.saveAreaMap(job);}}}
  sessions():MissionSession[] {
    return this.db.prepare('SELECT id FROM mission_sessions ORDER BY updated_at DESC,rowid DESC LIMIT 100').all().map(row=>this.session(row['id'] as string)!);
  }
  createSession(title='New mission',id=`session-${randomUUID()}`):MissionSession {
    const at=new Date().toISOString();
    this.db.prepare('INSERT INTO mission_sessions VALUES(?,?,?,?)').run(id,title.replace(/\s+/g,' ').trim().slice(0,80)||'New mission',at,at);
    this.changed();return this.session(id)!;
  }
  defaultSession():MissionSession { return this.sessions()[0]??this.createSession(); }
  private touchSession(id:string,message:string) {
    this.db.prepare("UPDATE mission_sessions SET title=CASE WHEN title='New mission' THEN ? ELSE title END,updated_at=? WHERE id=?")
      .run(message.replace(/\s+/g,' ').trim().slice(0,80),new Date().toISOString(),id);
  }
  noteSessionActivity(id:string,message:string){this.touchSession(id,message);}
  requirements(sessionId:string):MissionRequirements|null {
    const row=this.db.prepare('SELECT value FROM mission_requirements WHERE session_id=? ORDER BY version DESC LIMIT 1').get(sessionId);
    return row?JSON.parse(row['value'] as string):null;
  }
  saveConversationAttempt(turnId:string,value:RejectedConversationAttempt){this.db.prepare('INSERT INTO conversation_attempts VALUES(?,?,?)').run(`attempt-${randomUUID()}`,turnId,JSON.stringify(value));}
  updateRequirements(sessionId:string,patch:unknown,messages:UserInputSource[],turnId:string):MissionRequirements {
    const previous=this.requirements(sessionId),next=applyMissionPatch(previous,patch,messages,turnId);
    if(previous?.revision===next.revision)return previous;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO mission_requirements VALUES(?,?,?)').run(sessionId,next.version,JSON.stringify(next));
      const affected=this.db.prepare("SELECT DISTINCT a.run_id FROM assessments a JOIN runs r ON a.run_id=r.id WHERE r.session_id=? AND a.status<>'invalidated'").all(sessionId);
      for(const row of affected) {
        const runId=row['run_id'] as string;
        this.db.prepare("UPDATE assessments SET status='invalidated',reason='Mission requirements changed; a fresh proposal and review are required.' WHERE run_id=?").run(runId);
        this.invalidateReviews(runId,'Operator mission requirements changed; this decision no longer applies.');
        this.event(runId,'coordinator','requirements_changed','Operator requirements changed. This proposal is superseded and requires a fresh calculation and review.',[next.id]);
      }
      this.db.exec('COMMIT');this.changed();return next;
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  bindRequirements(runId:string) {
    const run=this.run(runId);if(!run)throw new Error('Unknown mission run.');
    this.db.prepare('INSERT INTO mission_run_inputs VALUES(?,?)').run(runId,JSON.stringify(this.requirements(run.sessionId)));
  }
  boundRequirements(runId:string):MissionRequirements|null {
    const row=this.db.prepare('SELECT value FROM mission_run_inputs WHERE run_id=?').get(runId);
    return row?JSON.parse(row['value'] as string):null;
  }
  saveFeasibility(runId:string,value:MissionFeasibility){this.db.prepare('INSERT INTO mission_calculations VALUES(?,?) ON CONFLICT(run_id) DO UPDATE SET value=excluded.value').run(runId,JSON.stringify(value));this.changed();}
  feasibility(runId:string):MissionFeasibility|null{const row=this.db.prepare('SELECT value FROM mission_calculations WHERE run_id=?').get(runId);return row?JSON.parse(row['value'] as string):null;}
  reviews(runId:string,now=Date.now()):OperatorReview[] {
    const rows=this.db.prepare('SELECT * FROM operator_reviews WHERE run_id=? ORDER BY rowid').all(runId);
    return rows.map(row=>{
      const value=JSON.parse(row['value'] as string) as OperatorReview;let status=row['status'] as OperatorReview['status'],reason=row['reason'] as string|null;
      if(status==='active' && value.decision==='approve' && value.validUntil && Date.parse(value.validUntil)<=now) {
        status='expired';reason='The bounded operator approval expired; refresh sources and review again.';
        this.db.prepare("UPDATE operator_reviews SET status='expired',reason=? WHERE id=?").run(reason,value.id);
        this.event(runId,'operator','review_expired',reason,[value.id]);
      }
      return {...value,status,reason,replacementRunId:this.db.prepare('SELECT next_run_id FROM review_revisions WHERE review_id=?').get(value.id)?.['next_run_id'] as string|undefined ?? null};
    });
  }
  reviewByRequestId(requestId:string):OperatorReview|null {
    const row=this.db.prepare('SELECT run_id FROM operator_reviews WHERE id=?').get(`review-${requestId}`);
    return row?this.reviews(row['run_id'] as string).find(value=>value.id===`review-${requestId}`) ?? null:null;
  }
  saveReview(value:OperatorReview) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare("UPDATE operator_reviews SET status='superseded',reason='A newer operator decision replaced this decision.' WHERE plan_id=? AND status='active'").run(value.planId);
      this.db.prepare('INSERT INTO operator_reviews VALUES(?,?,?,?,?,?)').run(value.id,value.runId,value.planId,value.status,value.reason,JSON.stringify(value));
      if(value.decision!=='approve')this.db.prepare("UPDATE assessments SET status='invalidated',reason=? WHERE run_id=?").run(value.decision==='reject'?'The operator rejected this proposal.':'The operator requested a revised proposal.',value.runId);
      this.db.exec('COMMIT');
      this.event(value.runId,'operator',`proposal_${value.decision}`,`Local operator: ${value.decision.replaceAll('_',' ')} for plan v${value.version}. The decision binds its exact document, inputs, evidence and calculation; no dispatch is authorized.`,[value.id,value.planId]);
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  invalidateReviews(runId:string,reason:string) {
    const rows=this.db.prepare("SELECT id FROM operator_reviews WHERE run_id=? AND status='active'").all(runId);
    for(const row of rows){this.db.prepare("UPDATE operator_reviews SET status='invalidated',reason=? WHERE id=?").run(reason,row['id'] as string);this.event(runId,'operator','review_invalidated',reason,[row['id'] as string]);}
  }
  invalidateApprovalsAfterRestart() {
    const rows=this.db.prepare("SELECT DISTINCT run_id FROM operator_reviews WHERE status='active'").all();
    for(const row of rows)this.invalidateReviews(row['run_id'] as string,'Application restarted; the prior decision remains historical and sources require fresh review.');
  }
  linkReviewRevision(reviewId:string,runId:string){this.db.prepare('INSERT INTO review_revisions VALUES(?,?)').run(reviewId,runId);this.changed();}
  reviewForRevision(runId:string):OperatorReview|null {
    let current:string|null=runId;
    for(let depth=0;current && depth<20;depth++) {
      const row=this.db.prepare('SELECT r.run_id,r.id FROM operator_reviews r JOIN review_revisions x ON x.review_id=r.id WHERE x.next_run_id=?').get(current);
      if(row)return this.reviews(row['run_id'] as string).find(value=>value.id===row['id']) ?? null;
      current=this.lineage(current).previousRunId;
    }
    return null;
  }
  saveInterpretation(value:Interpretation) {
    this.db.prepare('INSERT INTO signal_interpretations VALUES(?,?,?,?,?,?)').run(value.id,value.cacheKey,value.runId,value.signalId,value.status,JSON.stringify(value));
    this.changed();
  }
  interpretations(runId:string):Interpretation[] {
    return this.db.prepare('SELECT value FROM signal_interpretations WHERE run_id=? ORDER BY rowid').all(runId).map(row=>JSON.parse(row['value'] as string));
  }
  cachedInterpretation(key:string):Interpretation|null {
    const row=this.db.prepare("SELECT value FROM signal_interpretations WHERE cache_key=? AND status='accepted' ORDER BY rowid LIMIT 1").get(key);
    return row?JSON.parse(row['value'] as string):null;
  }
  close() { this.db.close(); }
  beginConversation(message: string, mode: ConversationTurn['mode'],requestedSessionId?:string) {
    const session=requestedSessionId?this.session(requestedSessionId):this.defaultSession();
    if(!session)throw new Error('Mission conversation not found.');
    const id = `turn-${randomUUID()}`, sessionId = session.id;
    this.db.prepare('INSERT INTO conversation_turns VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run(id, sessionId, message, null, mode, 'pending', null, null, new Date().toISOString(), null);
    this.touchSession(sessionId,message);this.changed();
    return this.conversation(sessionId).find(turn => turn.id === id)!;
  }
  conversationReceipt(id: string, receipt: ConversationReceipt) {
    this.db.prepare("UPDATE conversation_turns SET receipt=? WHERE id=? AND status='pending'").run(JSON.stringify(receipt), id);
  }
  finishConversation(id: string, reply: string, action: ConversationTurn['action'], runId: string | null = null, failed = false) {
    this.db.prepare("UPDATE conversation_turns SET reply=?,action=?,run_id=?,status=? WHERE id=? AND status='pending'")
      .run(reply, action, runId, failed ? 'failed' : 'replied', id);
    this.changed();
  }
  interruptConversations() {
    this.db.prepare("UPDATE conversation_turns SET status='failed',reply='The application restarted before the coordinator reply completed. Check the investigation history before trying again.' WHERE status='pending'").run();
    this.db.prepare("UPDATE conversation_summaries SET status='failed',reply='The application restarted before the conversational summary completed. The structured investigation result remains available.' WHERE status='pending'").run();
    this.db.prepare("UPDATE documents SET status='failed' WHERE status='streaming'").run();
  }
  beginDocument(input: Pick<MissionDocument, 'actor' | 'kind' | 'title'> & Partial<Pick<MissionDocument, 'runId' | 'turnId' | 'taskId' | 'version' | 'metadata'>>) {
    const id = `document-${randomUUID()}`, at = new Date().toISOString();
    this.db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,input.runId ?? null,input.turnId ?? null,input.taskId ?? null,
      input.actor,input.kind,input.title,input.version ?? 1,'streaming','',at,at,JSON.stringify(input.metadata ?? {}));
    this.changed(); return id;
  }
  appendDocument(id: string, delta: string) {
    if (!delta) return;
    const row = this.db.prepare("SELECT markdown FROM documents WHERE id=? AND status='streaming'").get(id);
    if (!row) throw new Error('Document is no longer streaming.');
    const offset = (row['markdown'] as string).length;
    if (offset + delta.length > 100_000) throw new Error('Document size budget exceeded.');
    const at = new Date().toISOString();
    this.db.prepare('UPDATE documents SET markdown=markdown||?,updated_at=? WHERE id=?').run(delta,at,id);
    this.changed({ type: 'delta', documentId: id, offset, delta, updatedAt: at });
  }
  finishDocument(id: string, status: 'published' | 'failed', metadata: Record<string, unknown> = {}) {
    this.db.prepare("UPDATE documents SET status=?,metadata=?,updated_at=? WHERE id=? AND status='streaming'")
      .run(status,JSON.stringify(metadata),new Date().toISOString(),id); this.changed();
  }
  documents(runId?: string,sessionId?:string): MissionDocument[] {
    const query=sessionId?`SELECT d.* FROM documents d LEFT JOIN runs r ON r.id=d.run_id LEFT JOIN conversation_turns t ON t.id=d.turn_id
      WHERE COALESCE(r.session_id,t.session_id)=? AND ${runId?'(d.run_id=? OR d.run_id IS NULL)':'d.run_id IS NULL'} ORDER BY d.rowid DESC LIMIT 200`
      :runId?'SELECT * FROM documents WHERE run_id=? OR run_id IS NULL ORDER BY rowid DESC LIMIT 100':'SELECT * FROM documents ORDER BY rowid DESC LIMIT 100';
    const parameters=sessionId?(runId?[sessionId,runId]:[sessionId]):runId?[runId]:[];
    return this.db.prepare(query).all(...parameters).reverse().map(row => ({
      id: row['id'] as string,runId: row['run_id'] as string | null,turnId: row['turn_id'] as string | null,taskId: row['task_id'] as string | null,
      actor: row['actor'] as string,kind: row['kind'] as MissionDocument['kind'],title: row['title'] as string,version: row['version'] as number,
      status: row['status'] as MissionDocument['status'],markdown: row['markdown'] as string,createdAt: row['created_at'] as string,
      updatedAt: row['updated_at'] as string,metadata: JSON.parse(row['metadata'] as string),
    }));
  }
  saveCitations(values: EvidenceCitation[]) {
    const insert = this.db.prepare('INSERT OR IGNORE INTO citations VALUES(?,?,?)');
    for (const value of values) insert.run(value.runId,value.id,JSON.stringify(value));
    this.changed();
  }
  citations(runId: string): EvidenceCitation[] {
    return this.db.prepare('SELECT value FROM citations WHERE run_id=? ORDER BY id').all(runId).map(row => JSON.parse(row['value'] as string));
  }
  saveBundle(bundle: ReportBundle) {
    this.db.prepare('INSERT INTO report_bundles VALUES(?,?) ON CONFLICT(run_id) DO UPDATE SET value=excluded.value').run(bundle.runId,JSON.stringify(bundle)); this.changed();
  }
  bundle(runId: string): ReportBundle | null { const row = this.db.prepare('SELECT value FROM report_bundles WHERE run_id=?').get(runId); return row ? JSON.parse(row['value'] as string) : null; }
  rejectBundle(runId:string,reason:string) {
    const bundle=this.bundle(runId);if(!bundle)throw new Error('No bundle to reject.');
    this.db.prepare("UPDATE assessments SET status='invalidated',reason=? WHERE run_id=? AND status<>'invalidated'").run(reason,runId);
    this.saveBundle({...bundle,status:'failed',note:reason});
    this.event(runId,'evaluator','quality_rejected',reason);
  }
  beginConversationSummary(runId: string) {
    this.db.prepare("INSERT INTO conversation_summaries VALUES(?,'pending',NULL,NULL)").run(runId);
  }
  finishConversationSummary(runId: string, reply: string, receipt: ConversationReceipt | null) {
    this.db.prepare("UPDATE conversation_summaries SET status=?,reply=?,receipt=? WHERE run_id=? AND status='pending'")
      .run(receipt ? 'complete' : 'failed', reply, receipt ? JSON.stringify(receipt) : null, runId);
  }
  conversationSummaries(sessionId?:string): ConversationSummary[] {
    return this.db.prepare(sessionId?'SELECT s.* FROM conversation_summaries s JOIN runs r ON r.id=s.run_id WHERE r.session_id=? ORDER BY s.rowid DESC LIMIT 200'
      :'SELECT * FROM conversation_summaries ORDER BY rowid DESC LIMIT 20').all(...(sessionId?[sessionId]:[])).map(row => ({
      runId: row['run_id'] as string, status: row['status'] as ConversationSummary['status'], reply: row['reply'] as string | null,
      receipt: row['receipt'] ? JSON.parse(row['receipt'] as string) : null,
    }));
  }
  conversation(sessionId?:string): ConversationTurn[] {
    return this.db.prepare(sessionId?'SELECT * FROM conversation_turns WHERE session_id=? ORDER BY rowid DESC LIMIT 200'
      :'SELECT * FROM conversation_turns ORDER BY rowid DESC LIMIT 20').all(...(sessionId?[sessionId]:[])).reverse().map(row => ({
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
    if(!this.session(sessionId))this.createSession(message,sessionId);
    this.touchSession(sessionId,message);
    const id = `mission-${randomUUID()}`;
    this.db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?,?,?)').run(id, sessionId, message, cause, 'running', new Date().toISOString(), null, null);
    return this.run(id)!;
  }
  event(runId: string, actor: string, kind: string, detail: string, evidenceIds: string[] = [], taskId: string | null = null, parentTaskId: string | null = null) {
    this.db.prepare('INSERT INTO events(run_id,task_id,parent_task_id,actor,kind,detail,evidence_ids,at) VALUES(?,?,?,?,?,?,?,?)')
      .run(runId, taskId, parentTaskId, actor, kind, detail, JSON.stringify(evidenceIds), new Date().toISOString());
    this.changed();
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
    const affected = this.db.prepare("SELECT id,run_id,evidence FROM assessments WHERE source_id=? AND revision<>? AND status<>'invalidated'").all(evidence.sourceId, evidence.revision)
      .filter(row=>{const previous=JSON.parse(row['evidence'] as string) as FederatedEvidence;
        return (previous.dependencyBaseRevision ?? previous.revision)!==(evidence.dependencyBaseRevision ?? evidence.revision) || previous.requirements?.id===evidence.requirements?.id;});
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const row of affected) {
        this.db.prepare("UPDATE assessments SET status='invalidated',reason=? WHERE id=?").run('Federated community evidence or logistics changed; fresh review required.', row['id'] as string);
        this.invalidateReviews(row['run_id'] as string,'A relevant source, resource or mission dependency changed. The prior operator decision is withdrawn.');
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
    this.changed();
  }
  interrupt(runId: string) {
    this.db.prepare("UPDATE assessments SET status='invalidated',reason='Investigation interrupted; fresh review required.' WHERE run_id=? AND status='draft'").run(runId);
    this.db.prepare("UPDATE runs SET status='interrupted',finished_at=? WHERE id=? AND status='running'").run(new Date().toISOString(), runId);
    this.db.prepare("UPDATE tasks SET status='interrupted' WHERE run_id=? AND status='running'").run(runId);
  }
  resumeExport(runId:string){
    if(this.bundle(runId)?.status!=='failed' || this.currency(runId).status==='superseded')throw new Error('Only an incomplete current export can resume.');
    this.db.prepare("UPDATE runs SET status='running',finished_at=NULL WHERE id=? AND status IN ('complete','interrupted')").run(runId);this.changed();
  }
  run(id: string): JournalRun | null {
    const row = this.db.prepare('SELECT * FROM runs WHERE id=?').get(id);
    return row ? { id, sessionId: row['session_id'] as string, message: row['message'] as string, cause: row['cause'] as string,
      status: row['status'] as JournalRun['status'], startedAt: row['started_at'] as string, finishedAt: row['finished_at'] as string | null,
      result: row['result'] ? JSON.parse(row['result'] as string) : null } : null;
  }
  recent(sessionId?:string): JournalRun[] {
    return this.db.prepare(sessionId?'SELECT id FROM runs WHERE session_id=? ORDER BY started_at DESC,rowid DESC LIMIT 20'
      :'SELECT id FROM runs ORDER BY started_at DESC,rowid DESC LIMIT 20').all(...(sessionId?[sessionId]:[])).map(row => this.run(row['id'] as string)!);
  }
  linkReplacement(previousRunId: string, nextRunId: string,cause='source_change') {
    const before=this.run(previousRunId),after=this.run(nextRunId);
    if(!before || !after || before.id===after.id || before.sessionId!==after.sessionId)throw new Error('Invalid mission replacement lineage.');
    this.db.prepare('INSERT INTO mission_replacements VALUES(?,?,?)').run(previousRunId,nextRunId,new Date().toISOString());
    this.event(previousRunId,'coordinator','replacement_started',cause==='operator_revision'?'Mission Coordinator is preparing a replacement after the operator requested changes. This proposal and its downloads remain historical.':'Mission Coordinator is preparing a replacement after changed evidence. This run and its downloads remain historical.',[nextRunId]);
    this.event(nextRunId,'coordinator','replaces_run',cause==='operator_revision'?'Mission Coordinator has started a revised committee proposal in response to the operator decision.':'Mission Coordinator has started a new evidence review to replace the previous mission snapshot.',[previousRunId]);
  }
  lineage(runId:string) {
    return {previousRunId:this.db.prepare('SELECT previous_run_id FROM mission_replacements WHERE next_run_id=?').get(runId)?.['previous_run_id'] as string|undefined ?? null,
      replacementRunId:this.db.prepare('SELECT next_run_id FROM mission_replacements WHERE previous_run_id=?').get(runId)?.['next_run_id'] as string|undefined ?? null};
  }
  currency(runId:string) {
    const assessment=this.assessments(runId).at(-1);
    return {status:assessment?.status==='invalidated'?'superseded' as const:'snapshot' as const,
      reason:assessment?.status==='invalidated'?assessment.reason:null,...this.lineage(runId)};
  }
}
