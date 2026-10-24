import { EventStore } from "./store.ts";
import type { Context, Entity, Fact, IngestObservation, IngestReport, MergeProposal, Provenance, Relationship, WorldEvent, WorldModelOptions } from "./types.ts";
export * from "./types.ts";
export { canonicalJson, entityIdFromName, externalId, normalizeName, sha256Hex } from "./stableIds.ts";
export { levenshtein, nameSimilarity, decide, jaccard } from "./resolve.ts";
export { worldStateShape } from "./ingest.ts";
type ExternalKey = {
    system: string;
    id: string;
};
interface UpsertEntityInput {
    type: string;
    externalKey?: ExternalKey;
    name?: string;
    attrs?: Record<string, unknown>;
    source: Provenance;
    state?: Entity["state"];
}
interface UpsertContextInput {
    type: string;
    externalKey?: ExternalKey;
    attrs?: Record<string, unknown>;
    parent?: string;
    source: Provenance;
}
interface RelateInput {
    from: string;
    type: string;
    to: string;
    context?: string;
    attrs?: Record<string, unknown>;
    validFrom?: string;
    validTo?: string;
    source: Provenance;
}
interface AssertFactInput {
    about: string;
    predicate: string;
    value: unknown;
    confidence?: number;
    context?: string;
    source: Provenance;
}
interface CustomView<S> {
    events: string[];
    initialState: S;
    reducer: (state: S, event: WorldEvent) => S;
}
export declare class WorldModel {
    private store;
    private opts;
    private clock;
    private writeLock;
    private customViews;
    constructor(opts: WorldModelOptions);
    private enqueue;
    private normalizeProvenance;
    upsertEntity(input: UpsertEntityInput): Promise<Entity>;
    private foldEntityUpsert;
    upsertContext(input: UpsertContextInput): Promise<Context>;
    relate(input: RelateInput): Promise<Relationship>;
    assertFact(input: AssertFactInput): Promise<Fact>;
    ingest(observations: IngestObservation[]): Promise<IngestReport>;
    view(name: "graph"): GraphView;
    view(name: "facts"): FactsView;
    view(name: "snapshot"): SnapshotView;
    view(name: "timeline"): TimelineView;
    view(name: string): {
        get(): unknown;
    };
    registerView<S>(name: string, spec: CustomView<S>): void;
    mergeQueue(): readonly MergeProposal[];
    approveMerge(proposalId: string, by: string): Promise<void>;
    rejectMerge(proposalId: string, by: string): Promise<void>;
    audit(): readonly import("./types.ts").AuditEntry[];
    events(): readonly WorldEvent[];
    stateShape(): unknown;
    stateShapeCanonical(): string;
    subscribeEvents(fn: (e: WorldEvent) => void): () => void;
}
declare class GraphView {
    private store;
    constructor(store: EventStore);
    entity(id: string): Entity | undefined;
    neighborsOf(id: string, opts?: {
        via?: string;
        inContext?: string;
        at?: string;
    }): Entity[];
    incoming(id: string, opts?: {
        via?: string;
    }): Entity[];
    entitiesInContext(contextId: string, opts?: {
        type?: string;
    }): Entity[];
    traverse(startId: string, opts: {
        via: string;
        direction: "ancestors" | "descendants";
        maxDepth?: number;
    }): Entity[];
    query(opts: {
        type?: string;
        where?: (e: Entity) => boolean;
    }): Entity[];
}
declare class FactsView {
    private store;
    constructor(store: EventStore);
    about(id: string): Fact[];
}
declare class SnapshotView {
    private store;
    constructor(store: EventStore);
    entityAt(id: string, at: string): Entity | undefined;
}
declare class TimelineView {
    private store;
    constructor(store: EventStore);
    subscribe(fn: (e: WorldEvent) => void): () => void;
    get(): WorldEvent[];
}
