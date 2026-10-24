import {
  canonicalJson,
  externalId,
  sha256Hex,
  WorldModel,
} from '../../../vendor/meterless-world-model/dist/index.js';

export type ReliefObservation = {
  id: string;
  originId: string;
  sourceId: string;
  sourceKind: 'file' | 'api' | 'wire' | 'manual';
  segmentId: string;
  claim: 'passable' | 'blocked';
  observedAt: string;
  expiresAt: string;
  forwarded: boolean;
  simulated: boolean;
};

export type SegmentAssessment = {
  segmentId: string;
  status: 'unknown' | 'reported_passable' | 'reported_blocked' | 'disputed';
  independentOrigins: number;
  evidenceIds: string[];
  fingerprint: string;
};

export type TrackedPlan = {
  id: string;
  segmentIds: string[];
  createdAt: string;
  status: 'proposed' | 'invalidated';
  assumptions: SegmentAssessment[];
  evidenceVersion: string;
  invalidatedAt?: string;
  reason?: string;
};

function instant(value: string): number {
  const result = Date.parse(value);
  if (!Number.isFinite(result) || !/(Z|[+-]\d\d:\d\d)$/.test(value)) {
    throw new Error('A timestamp with an explicit timezone is required.');
  }
  return result;
}

function identifier(value: string): void {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value)) {
    throw new Error('Invalid relief record identifier.');
  }
}

/** Server/CLI state adapter. A reported road claim is not a dispatch approval. */
export class ReliefWorld {
  private readonly model: WorldModel;
  private writes: Promise<unknown> = Promise.resolve();

  constructor(options: { namespace: string; directory?: string }) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(options.namespace)) {
      throw new Error('Invalid world namespace.');
    }
    this.model = new WorldModel({
      namespace: options.namespace,
      storage: options.directory ? 'local' : 'memory',
      directory: options.directory,
    });
  }

  private serialize<T>(write: () => Promise<T>): Promise<T> {
    const result = this.writes.then(write);
    this.writes = result.catch(() => undefined);
    return result;
  }

  capture(input: ReliefObservation): Promise<{ changed: boolean }> {
    const observation = structuredClone(input);
    return this.serialize(async () => {
      for (const value of [observation.id, observation.originId, observation.sourceId, observation.segmentId]) {
        identifier(value);
      }
      if (!['passable', 'blocked'].includes(observation.claim) ||
          !['file', 'api', 'wire', 'manual'].includes(observation.sourceKind) ||
          typeof observation.simulated !== 'boolean' || typeof observation.forwarded !== 'boolean') {
        throw new Error('Invalid observation claim or provenance.');
      }
      if (instant(observation.expiresAt) <= instant(observation.observedAt)) {
        throw new Error('Observation expiry must follow observation time.');
      }
      const conflict = this.model.view('graph').query({ type: 'observation' }).some(entity => {
        const known = entity.attrs as ReliefObservation;
        return known.originId === observation.originId && known.segmentId === observation.segmentId &&
          instant(known.observedAt) === instant(observation.observedAt) &&
          (known.claim !== observation.claim || instant(known.expiresAt) !== instant(observation.expiresAt));
      });
      if (conflict) throw new Error('Conflicting content for the same originating observation.');
      const id = externalId('observation', 'portal-one', observation.id);
      const existing = this.model.view('graph').entity(id);
      if (existing) {
        if (canonicalJson(existing.attrs) !== canonicalJson(observation)) {
          throw new Error('An observation ID cannot be rewritten; submit a new observation.');
        }
        return { changed: false };
      }
      await this.model.upsertEntity({
        type: 'observation',
        externalKey: { system: 'portal-one', id: observation.id },
        attrs: observation,
        source: {
          kind: observation.sourceKind,
          by: observation.sourceId,
          at: observation.observedAt,
          checksum: sha256Hex(canonicalJson(observation)),
        },
      });
      return { changed: true };
    });
  }

  assess(segmentId: string, asOf: string): SegmentAssessment {
    identifier(segmentId);
    const now = instant(asOf);
    const origins = new Map<string, ReliefObservation>();
    const observations = this.model.view('graph').query({ type: 'observation' })
      .map(entity => entity.attrs as ReliefObservation)
      .filter(item => item.segmentId === segmentId && instant(item.observedAt) <= now);
    for (const item of observations) {
      const previous = origins.get(item.originId);
      if (!previous || instant(item.observedAt) > instant(previous.observedAt) ||
          (item.observedAt === previous.observedAt && previous.forwarded && !item.forwarded)) {
        origins.set(item.originId, item);
      }
    }
    // Choose the latest claim per origin before applying expiry. An expired newer
    // claim must not resurrect an older claim from that same origin.
    const current = [...origins.values()].filter(item => instant(item.expiresAt) > now)
      .sort((left, right) => left.originId.localeCompare(right.originId));
    const claims = new Set(current.map(item => item.claim));
    const status: SegmentAssessment['status'] = claims.size > 1 ? 'disputed'
      : claims.has('blocked') ? 'reported_blocked'
      : claims.has('passable') ? 'reported_passable' : 'unknown';
    const fingerprint = sha256Hex(canonicalJson({ segmentId, status, origins: current.map(item => ({
      originId: item.originId, claim: item.claim, observedAt: item.observedAt, expiresAt: item.expiresAt,
    })) }));
    return { segmentId, status, independentOrigins: current.length,
      evidenceIds: current.map(item => item.id), fingerprint };
  }

  recordPlan(input: { id: string; segmentIds: string[] }, asOf: string): Promise<TrackedPlan> {
    const request = structuredClone(input);
    return this.serialize(async () => {
      identifier(request.id);
      instant(asOf);
      if (!request.segmentIds.length) throw new Error('A plan requires road segments.');
      const id = externalId('plan', 'portal-one', request.id);
      if (this.model.view('graph').entity(id)) throw new Error('Use a new ID for a revised plan.');
      const segmentIds = [...new Set(request.segmentIds)].sort();
      const assumptions = segmentIds.map(segment => this.assess(segment, asOf));
      const plan: TrackedPlan = { id: request.id, segmentIds, createdAt: asOf, status: 'proposed',
        assumptions, evidenceVersion: sha256Hex(canonicalJson(assumptions.map(item => item.fingerprint))) };
      await this.writePlan(plan, asOf);
      return structuredClone(plan);
    });
  }

  reviewPlan(planId: string, asOf: string): Promise<TrackedPlan> {
    return this.serialize(async () => {
      identifier(planId);
      const stored = this.model.view('graph').entity(externalId('plan', 'portal-one', planId));
      if (!stored) throw new Error('Unknown plan.');
      const plan = structuredClone(stored.attrs) as TrackedPlan;
      if (instant(asOf) < instant(plan.createdAt)) throw new Error('Cannot review before plan creation.');
      if (plan.status === 'invalidated') return plan;
      const changes = plan.assumptions.flatMap(before => {
        const after = this.assess(before.segmentId, asOf);
        return before.fingerprint === after.fingerprint ? []
          : [`${before.segmentId}: ${before.status} -> ${after.status}; evidence changed`];
      });
      if (changes.length) {
        plan.status = 'invalidated';
        plan.invalidatedAt = asOf;
        plan.reason = changes.join('; ');
        await this.writePlan(plan, asOf);
      }
      return plan;
    });
  }

  private async writePlan(plan: TrackedPlan, at: string): Promise<void> {
    await this.model.upsertEntity({ type: 'plan', externalKey: { system: 'portal-one', id: plan.id },
      attrs: plan, source: { kind: 'agent', by: 'relief-assumption-tracker', at } });
  }

  audit() { return structuredClone(this.model.audit()); }
}
