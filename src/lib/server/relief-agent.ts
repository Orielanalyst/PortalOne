import { randomUUID } from 'node:crypto';
import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { MissionSchema, timestamp } from './relief-data';
import type { ReliefDataSource, ReliefMission, ReliefSnapshot, QueryReceipt } from './relief-data';
import { ProposalSchema } from './relief-planner';
import type { ReliefPlanner, Proposal, ModelReceipt } from './relief-planner';
import { validateRelief } from './relief-validator';
import type { Validation } from './relief-validator';
import type { ReliefWorld, TrackedPlan } from './relief-world';

export type RunEvent = { id: string; runId: string; at: string; simulationAt: string; actor: string;
  kind: string; detail: string; evidenceIds: string[]; dataRevision?: string; planVersion?: number };
const State = Annotation.Root({ snapshot: Annotation<ReliefSnapshot>(), proposal: Annotation<Proposal | null>(),
  validation: Annotation<Validation | null>(), attempt: Annotation<number>(),
  disposition: Annotation<'running' | 'operator_review' | 'hold'>(), trackedPlan: Annotation<TrackedPlan | null>() });
export type ReliefRun = { runId: string; mission: ReliefMission; asOf: string; dataMode: ReliefSnapshot['mode'] | null;
  plannerMode: ReliefPlanner['mode']; disposition: 'operator_review' | 'hold'; proposal: Proposal | null;
  validation: Validation | null; trackedPlan: TrackedPlan | null; events: RunEvent[];
  queries: QueryReceipt[]; models: ModelReceipt[]; reservedQuerySlots: number; durationMs: number };

export async function runRelief(options: { mission: ReliefMission; asOf: string; source: ReliefDataSource;
  planner: ReliefPlanner; world: ReliefWorld; initialDraft?: Proposal;
  limits?: { timeoutMs?: number; maxRevisions?: number; maxQueries?: number } }): Promise<ReliefRun> {
  const mission = MissionSchema.parse(options.mission);
  timestamp.parse(options.asOf);
  const initialDraft = options.initialDraft ? ProposalSchema.parse(options.initialDraft) : undefined;
  const timeoutMs = Math.max(1, Math.floor(Math.min(options.limits?.timeoutMs ?? 300_000, 300_000)));
  const maxRevisions = Math.max(0, Math.floor(Math.min(options.limits?.maxRevisions ?? 2, 2)));
  const maxQueries = Math.max(0, Math.floor(Math.min(options.limits?.maxQueries ?? 12, 12)));
  const started = performance.now();
  const signal = AbortSignal.timeout(timeoutMs);
  const runId = `run-${randomUUID()}`;
  const events: RunEvent[] = [], queries: QueryReceipt[] = [], models: ModelReceipt[] = [];
  let reservedQuerySlots = 0, currentSnapshot: ReliefSnapshot | null = null;
  const emit = (actor: string, kind: string, detail: string, evidenceIds: string[] = [], planVersion?: number) => {
    events.push({ id: `${runId}:${events.length + 1}`, runId, at: new Date().toISOString(), simulationAt: options.asOf,
      actor, kind, detail, evidenceIds, dataRevision: currentSnapshot?.dataRevision, planVersion });
  };
  const check = () => { signal.throwIfAborted(); };
  async function bounded<T>(operation: Promise<T>): Promise<T> {
    check();
    let listener: () => void;
    const abort = new Promise<never>((_, reject) => { listener = () => reject(new Error('Run deadline reached.')); signal.addEventListener('abort', listener, { once: true }); });
    try { return await Promise.race([operation, abort]); }
    finally { signal.removeEventListener('abort', listener!); }
  }
  async function load(actor: string) {
    check();
    if (reservedQuerySlots + 2 > maxQueries) throw new Error('Run query budget reached.');
    reservedQuerySlots += 2; // Each source load has exactly two fixed SELECT templates.
    const snapshot = await bounded(options.source.load(mission, options.asOf, signal));
    check();
    currentSnapshot = snapshot;
    for (const query of snapshot.queries) {
      queries.push(query);
      emit(actor, 'query', `${query.name}: ${query.rowCount} bounded rows in ${query.durationMs} ms`, [query.id]);
    }
    for (const observation of snapshot.observations) await options.world.capture(observation);
    emit(actor, 'snapshot', `${snapshot.mode}; ${snapshot.candidates.length} candidates; latest reports by independent origin`, snapshot.observations.map(o => o.id));
    return snapshot;
  }
  const graph = new StateGraph(State)
    .addNode('gather', async () => ({ snapshot: await load('data'), attempt: 0, disposition: 'running' as const, proposal: null, validation: null, trackedPlan: null }))
    .addNode('propose', async state => {
      check();
      if (state.attempt === 0 && initialDraft) {
        emit('draft_input', 'draft', 'Supplied draft entered for independent validation; not an AI-generated or approved plan.', [], 1);
        return { proposal: initialDraft };
      }
      const result = await bounded(options.planner.propose({ mission, snapshot: state.snapshot, previous: state.validation,
        attempt: state.attempt, timeoutMs: Math.max(1, Math.min(180_000, timeoutMs - (performance.now() - started))), signal }));
      check();
      const proposal = ProposalSchema.parse(result.proposal);
      if (result.receipt) models.push(result.receipt);
      emit('planner', 'proposal', proposal.rationale, [], state.attempt + 1);
      return { proposal };
    })
    .addNode('validate', async state => {
      check();
      if (!state.proposal?.routeId || !state.proposal.vehicleId) {
        emit('validator', 'hold', 'Planner requested hold; no dispatch or approval issued.');
        return { disposition: 'hold' as const };
      }
      const snapshot = await load('validator'); // Never trust planner-supplied metrics or assessment.
      const candidate = snapshot.candidates.find(c => c.routeId === state.proposal!.routeId && c.vehicleId === state.proposal!.vehicleId);
      const validation = await validateRelief(mission, candidate, snapshot);
      check();
      if (!validation.eligible || !candidate) {
        emit('validator', 'rejected', validation.violations.map(v => `${v.code}: ${v.message}`).join(' '),
          validation.violations.flatMap(v => v.evidenceIds), state.attempt + 1);
        return { snapshot, validation, disposition: 'running' as const };
      }
      const trackedPlan = await options.world.recordPlan({ id: `${runId}:v${state.attempt + 1}`, segmentIds: candidate.segmentIds }, options.asOf);
      check();
      emit('validator', 'operator_review', 'Constraints passed for this synthetic snapshot. Human review required; no dispatch authorized.',
        [...candidate.evidenceIds, ...validation.assessments.flatMap(a => a.evidenceIds)], state.attempt + 1);
      return { snapshot, validation, trackedPlan, disposition: 'operator_review' as const };
    })
    .addNode('revise', state => {
      check();
      emit('planner', 'revision', 'Revise using the exact independent constraint violations.', [], state.attempt + 2);
      return { attempt: state.attempt + 1 };
    })
    .addNode('hold', () => {
      emit('validator', 'hold', 'Revision budget exhausted; no eligible proposal established.');
      return { disposition: 'hold' as const };
    })
    .addEdge(START, 'gather').addEdge('gather', 'propose').addEdge('propose', 'validate')
    .addConditionalEdges('validate', state => state.disposition !== 'running' ? END : state.attempt < maxRevisions ? 'revise' : 'hold')
    .addEdge('revise', 'propose').addEdge('hold', END).compile();
  try {
    const result = await bounded(graph.invoke({}, { recursionLimit: 12, signal }));
    return { runId, mission, asOf: options.asOf, dataMode: (currentSnapshot as ReliefSnapshot | null)?.mode ?? null,
      plannerMode: options.planner.mode, disposition: result.disposition === 'operator_review' ? 'operator_review' : 'hold',
      proposal: result.proposal, validation: result.validation, trackedPlan: result.trackedPlan, events, queries, models,
      reservedQuerySlots, durationMs: Math.round(performance.now() - started) };
  } catch (error) {
    const message = signal.aborted ? 'Run deadline reached; hold.'
      : error instanceof Error && error.message === 'Run query budget reached.' ? error.message : 'Dependency or proposal contract failed; hold.';
    emit('runtime', 'hold', message);
    return { runId, mission, asOf: options.asOf, dataMode: (currentSnapshot as ReliefSnapshot | null)?.mode ?? null,
      plannerMode: options.planner.mode, disposition: 'hold', proposal: null, validation: null, trackedPlan: null,
      events, queries, models, reservedQuerySlots, durationMs: Math.round(performance.now() - started) };
  }
}
