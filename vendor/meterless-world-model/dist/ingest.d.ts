import { entityIdFromName } from "./stableIds.ts";
import type { EventStore } from "./store.ts";
import type { IngestObservation, IngestReport } from "./types.ts";
export declare function runIngestPipeline(store: EventStore, observations: IngestObservation[], upsert: (obs: IngestObservation) => {
    entityId: string;
    entityIds: string[];
}, timer: () => number): IngestReport;
export declare function worldStateShape(store: EventStore): unknown;
export { entityIdFromName };
