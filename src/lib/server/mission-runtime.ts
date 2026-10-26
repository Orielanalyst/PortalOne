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
import { ConversationDecision, NightshiftConversation, replayConversation } from './mission-conversation';
import type { MissionConversation, InvestigationContext } from './mission-conversation';
import { runCommitteeMission } from './committee-mission';
import { buildCommitteeBundle } from './committee-export';
import { MissionWorld, observeMissionEvidence } from './mission-world';
import type { CommitteeWriter, CommitteeExporter } from './committee-mission';
import { NightshiftSignalInterpreter } from './signal-interpretation';
import type { SignalInterpreter } from './signal-interpretation';
import {loadReportInferenceConsent} from './report-inference-policy';
import { PublicIntegratedEvidence, ReliefWebPublicEvidence, OfflinePublicEvidence, IfrcPublicEvidence, ResilientPublicEvidence } from './public-evidence';
import type { PublicEvidenceSource } from './public-evidence';
import {roadIndex} from './spatial-grounding';
import {publicRequirements,withMissionRequirements,MissionInputError,fieldLabels} from './mission-requirements';
import {ReviewSubmissionSchema,reviewCandidate,assertReviewMatches,ReviewError} from './mission-review';
import type {ReviewSubmission,OperatorReview} from './mission-review';
import {missionFeasibility} from './mission-feasibility';
import {buildDossier} from './mission-dossier';

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
  readonly world: MissionWorld;
  readonly map = new CommunityMap();
  private readonly source: { origin: string | null; snapshot(signal?: AbortSignal,onRetry?:(detail:string)=>void): Promise<KoboSnapshot> };
  private readonly evidence: MissionEvidence;
  private active: string | null = null;
  private chatting = false;
  private reviewing=false;
  private reviewRunId:string|null=null;
  private monitor: { sessionId: string; runId:string; message: string; until: number; lastRevision?: string; autoRuns: number; workflow: 'investigation' | 'committee' } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sourceStatus: 'unchecked' | 'online' | 'unavailable' = 'unchecked';
  private checkedAt: string | null = null;
  private polling = false;
  private federationStatus: 'unchecked' | 'online' | 'unavailable' = 'unchecked';
  constructor(private readonly options: { journal?: MissionJournal; source?: { origin: string | null; snapshot(signal?: AbortSignal,onRetry?:(detail:string)=>void): Promise<KoboSnapshot> };
    dispatcher?: MissionDispatcher; pollIntervalMs?: number; evidence?: MissionEvidence; logistics?: MissionLogistics; conversation?: MissionConversation;
    world?:MissionWorld; committeeWriter?:CommitteeWriter; committeeExporter?:CommitteeExporter; interpreter?:SignalInterpreter; publicSource?:PublicEvidenceSource } = {}) {
    if (process.env['RELIEFINTEL_MODE'] && !['live', 'offline-replay'].includes(process.env['RELIEFINTEL_MODE'])) throw new Error('Unsupported ReliefIntel runtime mode.');
    this.journal = options.journal ?? new MissionJournal(`.runtime/${this.mode === 'live' ? 'mission' : 'mission-replay'}/journal.sqlite`);
    this.world=options.world ?? new MissionWorld({namespace:this.mode==='live'?'live-committee':'offline-committee',directory:options.journal?undefined:`.runtime/${this.mode==='live'?'mission':'mission-replay'}`});
    this.source = options.source ?? (this.mode === 'live' ? configuredKobo() : replayCommunitySource);
    const baseEvidence=options.evidence ?? (this.mode === 'live' ? new ZetarisCommunityEvidence(this.map) : new FixtureCommunityEvidence(this.map));
    this.evidence = new PublicIntegratedEvidence(baseEvidence,options.publicSource ??
      (this.mode==='live' && !options.source ? new ResilientPublicEvidence(new ReliefWebPublicEvidence({directory:'.runtime/public-evidence'}),new IfrcPublicEvidence({directory:'.runtime/public-evidence'})) : new OfflinePublicEvidence()),
      detail=>{const runId=this.active ?? this.reviewRunId;if(runId)this.journal.event(runId,'expert','public_source_read',detail);});
    this.journal.interruptConversations();
    this.journal.invalidateApprovalsAfterRestart();
    // No implicit dispatch/replay on restart. Persisted partial runs remain inspectable.
    for (const run of this.journal.recent()) if (run.status === 'running') {
      this.journal.event(run.id, 'runtime', 'interrupted', 'Application restarted; this investigation was interrupted. Start a fresh check.');
      this.journal.interrupt(run.id);
    }
  }
  private investigationContext(run: JournalRun): InvestigationContext | null {
    if (!run.result) return null;
    const assessment = this.journal.assessments(run.id).at(-1);
    const calculated=this.journal.feasibility(run.id);
    return { mission: run.message, summary: run.result.summary, at: run.finishedAt, gaps: run.result.gaps.slice(0, 12),
      reports: { demonstration: run.result.demoReports, liveLabelled: run.result.liveReports },
      communities: [...new Set(assessment?.evidence.rows.map(row => row.name) ?? [])].slice(0, 20),
      planning: assessment ? { status: assessment.status, advice: assessment.advice.rationale, mode: assessment.evidence.mode } : null,
      mappedFacilities:this.map.layers['facilities']!.features.filter(feature=>feature.properties?.['name']).map(feature=>({id:String(feature.properties!['evidenceId'] ?? feature.id),name:String(feature.properties!['name'])})),
      ...(calculated?{missionPlanning:{inputs:publicRequirements(this.journal.boundRequirements(run.id)),status:calculated.status,calculations:calculated.calculations,
        missing:calculated.missing,limitations:calculated.limitations,route:calculated.route?{id:calculated.route.id,from:calculated.route.from,to:calculated.route.to,distanceKm:calculated.route.distanceKm,status:calculated.route.status}:null}}:{}) };
  }
  private async concludeConversation(runId: string) {
    const turn = this.journal.conversation().find(item => item.runId === runId);
    const run = this.journal.run(runId);
    if (!turn || !run || this.mode === 'offline-replay') return;
    const context = this.investigationContext(run); if (!context) return;
    this.journal.beginConversationSummary(runId);
    const documentId = this.journal.beginDocument({ runId, actor: 'coordinator', kind: 'summary', title: 'Mission Coordinator · findings and next steps' });
    try {
      const conversation = this.options.conversation ?? new NightshiftConversation(configuredNightshift());
      if (!conversation.summarize) throw new Error('No conversational summary model.');
      const signal = AbortSignal.timeout(50_000);
      const summary = await conversation.summarize(context, signal, text => this.journal.appendDocument(documentId, text)); signal.throwIfAborted();
      if (!this.journal.documents(runId).find(document => document.id === documentId)?.markdown) this.journal.appendDocument(documentId, summary.reply);
      this.journal.finishDocument(documentId, 'published', { receipt: summary.receipt });
      this.journal.finishConversationSummary(runId, summary.reply, summary.receipt);
    } catch {
      this.journal.finishDocument(documentId, 'failed');
      this.journal.finishConversationSummary(runId, 'The structured findings are ready below, but I could not complete the model-backed summary. You can still inspect the evidence and blockers.', null);
    }
  }
  async chat(message: string, watchMinutes: number) {
    const text = message.trim();
    if (!text || text.length > 2000 || ![0, 30].includes(watchMinutes)) throw new Error('Invalid conversation request.');
    if (this.chatting || this.reviewing) throw new Error('The coordinator is already replying or refreshing an operator review.');
    const summaries = this.journal.conversationSummaries();
    const history = this.journal.conversation().filter(turn => turn.status === 'replied').slice(-6)
      .map(turn => ({ message: turn.message.slice(0, 1200), reply: [turn.reply,
        summaries.find(summary => summary.runId === turn.runId && summary.status === 'complete')?.reply].filter(Boolean).join('\n') }));
    const turn = this.journal.beginConversation(text, this.mode === 'live' ? 'live-model' : 'offline-replay');
    this.chatting = true;
    let documentId = this.journal.beginDocument({ turnId: turn.id, actor: 'coordinator', kind: 'reply', title: 'Mission Coordinator · response' });
    try {
      const responder = this.options.conversation ?? (this.mode === 'live'
        ? new NightshiftConversation(configuredNightshift(), receipt => this.journal.conversationReceipt(turn.id, receipt),attempt=>{
          this.journal.saveConversationAttempt(turn.id,attempt);this.journal.finishDocument(documentId,'failed',{validation:'conversation_contract',receipt:attempt.receipt});
          if(!attempt.terminal)documentId=this.journal.beginDocument({turnId:turn.id,actor:'coordinator',kind:'reply',title:'Mission Coordinator · correcting the reply and input structure'});
        }) : replayConversation);
      const latest = this.journal.recent().find(run => run.result);
      const signal = AbortSignal.timeout(50_000);
      const decision = ConversationDecision.parse(await responder.respond({ message: text, history,
        activeMission: this.active ? this.journal.run(this.active)?.message ?? 'Investigation in progress' : null,
        lastInvestigation: latest ? this.investigationContext(latest) : null,requirements:publicRequirements(this.journal.requirements(turn.sessionId)),messageAt:turn.createdAt }, signal, delta => this.journal.appendDocument(documentId, delta)));
      signal.throwIfAborted();
      if(decision.missionPatch && Object.keys(decision.missionPatch).length)this.journal.updateRequirements(turn.sessionId,decision.missionPatch,this.journal.conversation().map(item=>({text:item.message,at:item.createdAt,turnId:item.id})),turn.id);
      if (!this.journal.documents().find(document => document.id === documentId)?.markdown) this.journal.appendDocument(documentId, decision.reply);
      this.journal.finishDocument(documentId, 'published', { receipt: this.journal.conversation().find(item => item.id === turn.id)?.receipt });
      if (decision.action === 'investigate') {
        if (this.active) throw new Error('Investigation already running.');
        // No await between releasing this lock and reserving the investigation slot.
        this.chatting = false;
        const runId = this.start(`${decision.mission.objective}\nArea: ${decision.mission.area}`, watchMinutes, 'operator', turn.sessionId, this.options.committeeWriter || this.mode==='live' && !this.options.dispatcher ? 'committee' : 'investigation');
        this.journal.finishConversation(turn.id, decision.reply, decision.action, runId);
      } else this.journal.finishConversation(turn.id, decision.reply, 'reply');
    } catch(error) {
      if(error instanceof MissionInputError) {
        this.journal.finishDocument(documentId,'failed',{inputField:error.field,validation:'source_or_unit_check_failed'});
        const clarification=`Please confirm the ${fieldLabels[error.field]}. ${error.message} Your previous recorded values remain available.`;
        const correction=this.journal.beginDocument({turnId:turn.id,actor:'coordinator',kind:'reply',title:'Mission Coordinator · input clarification'});
        this.journal.appendDocument(correction,clarification);this.journal.finishDocument(correction,'published',{inputValidation:error.field});
        this.journal.finishConversation(turn.id,clarification,'reply');
      }else{
      this.journal.finishDocument(documentId, 'failed');
      this.journal.finishConversation(turn.id, this.active
        ? 'An investigation is already running. Follow its activity trace while it finishes; this message did not start another investigation.'
        : 'I could not complete the model-backed reply. Your message is saved; please try again. No investigation was started.', null, null, true);
      }
    } finally { this.chatting = false; this.schedule(); this.journal.changed(); }
    return this.journal.conversation().find(item => item.id === turn.id)!;
  }
  start(message: string, watchMinutes: number, cause = 'operator', sessionId?: string, workflow: 'investigation' | 'committee' = 'investigation',previousRunId?:string) {
    if (this.active || this.chatting || this.reviewing) throw new Error('The coordinator is already working.');
    const client = this.mode === 'live' && !this.options.dispatcher ? configuredNightshift() : null;
    const run = this.journal.startRun(message, cause, sessionId);
    this.journal.bindRequirements(run.id);
    if(previousRunId)this.journal.linkReplacement(previousRunId,run.id,cause);
    this.active = run.id;
    if (cause === 'operator') {
      this.stopMonitor();
      if (watchMinutes && this.mode === 'live') this.monitor = { sessionId: run.sessionId, runId:run.id, message, until: Date.now() + watchMinutes * 60_000, autoRuns: 0, workflow };
    }
    const dispatcher = this.options.dispatcher ?? (client ? new NightshiftDispatcher(client, receipt => this.journal.event(run.id, 'coordinator', 'model_receipt', receipt)) : replayDispatcher);
    const logistics = this.options.logistics ?? (client ? new NightshiftMissionLogistics(client) : new FixtureMissionLogistics());
    const dependencies = { run, journal: this.journal, map: this.map, dispatcher, logistics, evidence: { load: async (snapshot: KoboSnapshot, signal: AbortSignal) => {
      try {
        const bound=this.journal.boundRequirements(run.id),current=this.journal.requirements(run.sessionId);
        if((bound?.revision ?? null)!==(current?.revision ?? null))throw new Error('Mission requirements changed during preparation.');
        const context = withMissionRequirements(await this.evidence.load(snapshot, signal),bound);
        if((bound?.revision ?? null)!==(this.journal.requirements(run.sessionId)?.revision ?? null))throw new Error('Mission requirements changed during source refresh.');
        await observeMissionEvidence(this.world,this.journal,context,run.id); this.federationStatus = 'online'; return context;
      }
      catch (error) { this.federationStatus = 'unavailable'; throw error; }
    } }, readSource: async (signal: AbortSignal) => {
      try { const snapshot = await this.source.snapshot(signal,detail=>this.journal.event(run.id,'intake','source_read_retry',detail)); this.sourceStatus = 'online'; this.checkedAt = snapshot.checkedAt; return snapshot; }
      catch (error) { this.sourceStatus = 'unavailable'; this.checkedAt = new Date().toISOString();this.journal.event(run.id,'intake','source_read_failed','Kobo source could not be refreshed; the current snapshot is unconfirmed and publication remains blocked.');throw error; }
    } };
    const writer=this.options.committeeWriter ?? client;
    const investigation=workflow==='committee' && writer ? runCommitteeMission({...dependencies,world:this.world,writer,
      interpreter:this.options.interpreter ?? (client?new NightshiftSignalInterpreter(client,{consent:loadReportInferenceConsent(),providerBaseUrl:client.baseUrl}):undefined),exporter:this.options.committeeExporter ?? buildCommitteeBundle}) : runMission(dependencies);
    void investigation.then(async result => {
      const assessment = this.journal.assessments(run.id).find(a => a.id === result.assessmentId);
      if (assessment?.status === 'checked' && this.monitor?.sessionId === run.sessionId) this.monitor.lastRevision = assessment.evidence.revision;
      await this.concludeConversation(run.id);
    }).catch(() => this.journal.interrupt(run.id)).finally(() => { this.active = null; this.schedule(); this.journal.changed(); });
    return run.id;
  }
  stopMonitor() { this.monitor = null; if (this.timer) clearTimeout(this.timer); this.timer = null; this.journal.changed(); }
  async review(input:ReviewSubmission):Promise<{review:OperatorReview;replacementRunId:string|null}> {
    const command=ReviewSubmissionSchema.parse(input),known=this.journal.reviewByRequestId(command.requestId);
    if(known){if(JSON.stringify(ReviewSubmissionSchema.strip().parse(known))!==JSON.stringify(command))throw new ReviewError('This review request ID was already used for a different decision.');return {review:known,replacementRunId:known.replacementRunId ?? null};}
    if(this.active || this.chatting || this.reviewing)throw new ReviewError('Wait for the active work to finish before recording an operator decision.');
    assertReviewMatches(command,reviewCandidate(this.journal,command.runId));
    this.reviewing=true;this.reviewRunId=command.runId;this.journal.changed();
    try {
      let refreshedAt:string|null=null;
      if(command.decision==='approve') {
        const run=this.journal.run(command.runId)!,bound=this.journal.boundRequirements(run.id),signal=AbortSignal.timeout(90_000);
        this.journal.event(run.id,'coordinator','review_refresh_started','Mission Coordinator → Independent checker: refresh Kobo, the public feed and Zetaris before accepting this exact operator decision.',[command.planId]);
        const snapshot=await this.source.snapshot(signal);signal.throwIfAborted();this.journal.ingest(snapshot);
        this.journal.event(run.id,'checker','review_kobo_read',`Independent checker: refreshed ${snapshot.count} Kobo report versions for this decision.`,[command.planId]);
        const fresh=withMissionRequirements(await this.evidence.load(snapshot,signal,{freshPublic:true}),this.journal.requirements(run.sessionId));
        for(const receipt of fresh.queries)this.journal.event(run.id,'checker','review_query',`Zetaris ${receipt.name}: ${receipt.rowCount} rows returned in ${receipt.durationMs} ms.`,[receipt.id]);
        await observeMissionEvidence(this.world,this.journal,fresh,run.id);signal.throwIfAborted();
        if(fresh.revision!==command.evidenceRevision || (bound?.revision ?? null)!==(this.journal.requirements(run.sessionId)?.revision ?? null))throw new ReviewError('Source evidence or mission inputs changed during review. The old proposal is superseded; prepare and review the fresh version.');
        const calculation=buildDossier(run.id,run.message,snapshot,fresh,this.map,undefined,this.journal.interpretations(run.id)).planning ?? missionFeasibility(bound,this.map);
        this.journal.saveFeasibility(run.id,calculation);refreshedAt=new Date().toISOString();
        this.journal.event(run.id,'checker','review_refresh_complete','Independent checker: current source and mission versions match. The committee decision still retains all field and endpoint holds.',[command.planId,calculation.id]);
      }
      // No await between the final version check and durable decision write.
      const candidate=reviewCandidate(this.journal,command.runId);assertReviewMatches(command,candidate);
      const calculation=this.journal.feasibility(command.runId),bound=this.journal.boundRequirements(command.runId),createdAt=new Date().toISOString();
      const until=command.decision==='approve'?Math.min(Date.now()+10*60_000,Date.parse(calculation!.validUntil!),Date.parse(bound!.values.departAt!)):null;
      if(until!==null && until<=Date.now())throw new ReviewError('Departure or resource validity expired while the review was being refreshed.');
      const value:OperatorReview={...command,id:`review-${command.requestId}`,actor:'local_operator',scope:'committee_proposal_only',status:'active',reason:null,
        createdAt,refreshedAt,validUntil:until===null?null:new Date(until).toISOString(),dispatchAuthorized:false};
      this.journal.saveReview(value);
      let replacementRunId:string|null=null;
      if(command.decision==='request_changes') {
        const run=this.journal.run(command.runId)!;
        this.reviewing=false;
        replacementRunId=this.start(run.message,0,'operator_revision',run.sessionId,'committee',run.id);
        if(this.monitor?.sessionId===run.sessionId)this.monitor.runId=replacementRunId;
        this.journal.linkReviewRevision(value.id,replacementRunId);
        this.journal.event(replacementRunId,'coordinator','operator_revision_requested','Mission Coordinator is commissioning a revised proposal from the operator’s requested changes. The earlier draft and decision remain historical.',[value.id,command.planId]);
      }
      return {review:{...value,replacementRunId},replacementRunId};
    }catch(error){this.journal.event(command.runId,'checker','operator_review_held','The operator decision could not be accepted against the current source and proposal versions. No approval was granted.',[command.planId]);throw error;}
    finally{this.reviewing=false;this.reviewRunId=null;this.schedule();this.journal.changed();}
  }
  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    if (!this.monitor || Date.now() >= this.monitor.until) { this.stopMonitor(); return; }
    this.timer = setTimeout(() => { this.timer = null; void this.poll(); }, this.options.pollIntervalMs ?? 20_000);
    this.timer.unref?.();
  }
  private async poll() {
    if (!this.monitor || Date.now() >= this.monitor.until) { this.stopMonitor(); return; }
    if (this.active || this.chatting || this.polling) { this.schedule(); return; }
    const watching = this.monitor;
    this.polling = true;
    let koboRead = false;
    try {
      const signal = AbortSignal.timeout(Math.max(1, Math.min(30_000, watching.until - Date.now())));
      const snapshot = await this.source.snapshot(signal,detail=>this.journal.event(watching.runId,'intake','source_read_retry',detail));
      koboRead = true;
      if (this.monitor !== watching) return;
      if (Date.now() >= watching.until) { this.stopMonitor(); return; }
      const context = withMissionRequirements(await this.evidence.load(snapshot, signal),this.journal.requirements(watching.sessionId));
      if (this.monitor !== watching) return;
      if (Date.now() >= watching.until) { this.stopMonitor(); return; }
      if (this.chatting || this.active || this.reviewing) return;
      const previousStatus = this.sourceStatus;
      const previousFederationStatus = this.federationStatus;
      this.sourceStatus = 'online'; this.checkedAt = snapshot.checkedAt;
      this.federationStatus = 'online';
      const intake = this.journal.ingest(snapshot);
      await observeMissionEvidence(this.world,this.journal,context,watching.runId);
      if(this.monitor!==watching || Date.now()>=watching.until)return;
      if (intake.changed.length || watching.lastRevision !== context.revision || previousStatus === 'unavailable' || previousFederationStatus === 'unavailable') {
        if (watching.autoRuns >= 6) {
          const latest = this.journal.recent()[0]; if (latest) this.journal.event(latest.id, 'runtime', 'watch_budget_exhausted', 'Automatic investigation budget reached. Evidence is superseded; an operator must start a fresh watch.');
          this.stopMonitor(); return;
        }
        watching.autoRuns++; watching.lastRevision = context.revision;
        const runId = this.start(watching.message, 0, previousStatus === 'unavailable' || previousFederationStatus === 'unavailable' ? 'source_recovered' : 'source_change', watching.sessionId, watching.workflow,watching.runId);
        watching.runId=runId;
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
      conversation: this.journal.conversation(), chatBusy: this.chatting,
      conversationSummaries: this.journal.conversationSummaries(),
      documents: this.journal.documents(selected?.id), citations: selected ? this.journal.citations(selected.id) : [],
      reportBundle: selected ? this.journal.bundle(selected.id) : null,
      currency:selected?this.journal.currency(selected.id):null,
      memory:selected?this.world.view(selected.id):null,
      requirements:publicRequirements(this.journal.requirements(this.journal.conversation().at(-1)?.sessionId ?? selected?.sessionId ?? '')),
      selectedRequirements:selected?publicRequirements(this.journal.boundRequirements(selected.id)):null,
      planning:selected?this.journal.feasibility(selected.id):null,
      reviewCandidate:selected?reviewCandidate(this.journal,selected.id):null,
      reviews:selected?this.journal.reviews(selected.id):[],reviewBusy:this.reviewing,
      sourceStatus: this.sourceStatus, federationStatus: this.federationStatus, checkedAt: this.checkedAt,
      assessments: selected ? this.journal.assessments(selected.id) : [],
      assessmentStatuses: Object.fromEntries(runs.map(r => [r.id, this.journal.assessments(r.id).at(-1)?.status ?? null])),
      monitorUntil: this.monitor && this.monitor.until > Date.now() ? new Date(this.monitor.until).toISOString() : null,
      signals: signals.map(({ claimedOrigin: _privateOrigin, contentFingerprint: _fingerprint, location: _privateGps, ...signal }) => signal),
      groundings: signals.map(s => this.map.resolve(s)),
      roadGroundings:signals.map(s=>roadIndex(this.map).match(s)).filter(item=>item.status!=='not_access_report'),
      map: { version: this.map.cartographyVersion, bounds: this.map.manifest.bounds, attribution: this.map.attribution,
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
