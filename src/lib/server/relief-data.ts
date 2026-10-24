import { z } from 'zod';
import type { ReliefObservation } from './relief-world';

export const recordId = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/);
export const timestamp = z.iso.datetime({ offset: true });
export const MissionSchema = z.object({
  id: recordId, depotId: recordId, destinationId: recordId, sku: recordId,
  quantity: z.number().int().positive().max(10_000), deadline: timestamp,
  objective: z.literal('earliest_delivery'),
  handlingMinutes: z.number().nonnegative(), bufferMinutes: z.number().nonnegative(),
  fuelReserveLitres: z.number().nonnegative(), minimumIndependentOrigins: z.number().int().min(2),
}).strict();
export type ReliefMission = z.infer<typeof MissionSchema>;

export const CandidateSchema = z.object({
  routeId: recordId, vehicleId: recordId, segmentIds: z.array(recordId).min(1),
  distanceKm: z.number().positive(), travelMinutes: z.number().positive(),
  maxGrossKg: z.number().positive(), requiresFourWheelDrive: z.boolean(),
  payloadKg: z.number().positive(), tareKg: z.number().positive(),
  fuelLitres: z.number().nonnegative(), litresPerKm: z.number().positive(),
  fourWheelDrive: z.boolean(), available: z.boolean(), stockUnits: z.number().int().nonnegative(),
  unitMassKg: z.number().positive(), validFrom: timestamp, validUntil: timestamp,
  evidenceIds: z.array(recordId).min(1), simulated: z.literal(true),
}).strict();
export type ReliefCandidate = z.infer<typeof CandidateSchema>;

export type QueryReceipt = {
  id: string; name: string; sql: string; asOf: string; fetchedAt: string;
  durationMs: number; rowCount: number; resultHash: string;
};
export type ReliefSnapshot = {
  mode: 'live-zetaris-synthetic' | 'offline-fixture';
  asOf: string; dataRevision: string; candidates: ReliefCandidate[];
  observations: ReliefObservation[]; queries: QueryReceipt[];
};
export interface ReliefDataSource {
  load(mission: ReliefMission, asOf: string, signal?: AbortSignal): Promise<ReliefSnapshot>;
}
