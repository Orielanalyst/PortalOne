import type { AuditEntry, Context, Entity, EventKind, Fact, Relationship, WorldEvent, MergeProposal, ObservationRecord, StoryAggregate, ScoreSnapshot } from "./types.ts";
export interface FoldedState {
    entities: Map<string, Entity>;
    contexts: Map<string, Context>;
    relationships: Map<string, Relationship>;
    facts: Map<string, Fact>;
    aliases: Map<string, string>;
}
export declare class EventStore {
    events: WorldEvent[];
    audit: AuditEntry[];
    observations: Map<string, ObservationRecord>;
    stories: Map<string, StoryAggregate>;
    scores: ScoreSnapshot[];
    mergeQueue: MergeProposal[];
    state: FoldedState;
    private seq;
    private auditSeq;
    private file?;
    private subscribers;
    constructor(namespace: string, storage: "memory" | "local", directory?: string);
    append(kind: EventKind, payload: WorldEvent["payload"], at: string): WorldEvent;
    private applyAndRecord;
    private fold;
    foldUntil(at: string): FoldedState;
    resolveAlias(id: string): string;
    logAudit(kind: string, actor: string, summary: string, eventId?: string, runId?: string, at?: string): void;
    subscribe(fn: (e: WorldEvent) => void): () => void;
    persist(): void;
}
