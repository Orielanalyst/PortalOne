import { CandidateSchema, MissionSchema, timestamp } from './relief-data';
import type { ReliefCandidate, ReliefMission, ReliefSnapshot } from './relief-data';
import { ReliefWorld } from './relief-world';
import type { SegmentAssessment } from './relief-world';

export type Violation = { code: string; message: string; evidenceIds: string[] };
export type Validation = { eligible: boolean; violations: Violation[]; assessments: SegmentAssessment[];
  calculations: { cargoKg: number; grossKg: number; requiredFuelLitres: number; arrivalAt: string } | null };

/** Pure constraints after an independently fetched snapshot; no model approval. */
async function validateCandidate(missionInput: ReliefMission, candidateInput: ReliefCandidate | undefined,
  snapshot: ReliefSnapshot): Promise<Validation> {
  const mission = MissionSchema.parse(missionInput);
  timestamp.parse(snapshot.asOf);
  if (!candidateInput) return { eligible: false, calculations: null, assessments: [], violations: [
    { code: 'UNKNOWN_CANDIDATE', message: 'Proposed route and vehicle are absent from the independent snapshot.', evidenceIds: [] },
  ] };
  const candidate = CandidateSchema.parse(candidateInput);
  const cargoKg = mission.quantity * candidate.unitMassKg;
  const grossKg = candidate.tareKg + cargoKg;
  const requiredFuelLitres = candidate.distanceKm * 2 * candidate.litresPerKm * 1.5 + mission.fuelReserveLitres;
  const arrival = Date.parse(snapshot.asOf) + (candidate.travelMinutes + mission.handlingMinutes + mission.bufferMinutes) * 60_000;
  const arrivalAt = new Date(arrival).toISOString();
  const violations: Violation[] = [];
  const add = (code: string, message: string, evidenceIds = candidate.evidenceIds) => violations.push({ code, message, evidenceIds });
  if (!candidate.available) add('VEHICLE_UNAVAILABLE', 'The vehicle is unavailable.');
  if (mission.quantity > candidate.stockUnits) add('INSUFFICIENT_STOCK', `Need ${mission.quantity} kits; ${candidate.stockUnits} available.`);
  if (cargoKg > candidate.payloadKg) add('PAYLOAD_EXCEEDED', `${cargoKg} kg cargo exceeds ${candidate.payloadKg} kg payload capacity.`);
  if (grossKg > candidate.maxGrossKg) add('GROSS_WEIGHT_EXCEEDED', `${grossKg} kg loaded vehicle exceeds ${candidate.maxGrossKg} kg segment limit.`);
  if (candidate.requiresFourWheelDrive && !candidate.fourWheelDrive) add('FOUR_WHEEL_DRIVE_REQUIRED', 'This route requires a four-wheel-drive vehicle.');
  if (requiredFuelLitres > candidate.fuelLitres) add('INSUFFICIENT_FUEL', `Round trip, 50 percent contingency and fixed reserve need ${requiredFuelLitres} L; ${candidate.fuelLitres} L available.`);
  if (arrival > Date.parse(mission.deadline)) add('DELIVERY_DEADLINE', `Delivery including handling and buffer ends at ${arrivalAt}, after ${mission.deadline}.`);
  if (Date.parse(candidate.validFrom) > Date.parse(snapshot.asOf) || Date.parse(candidate.validUntil) <= arrival) {
    add('STALE_LOGISTICS', 'Logistics evidence is unavailable at departure or expires before delivery.');
  }
  const world = new ReliefWorld({ namespace: 'independent-validation' });
  for (const observation of snapshot.observations) await world.capture(observation);
  const assessments = candidate.segmentIds.map(id => world.assess(id, snapshot.asOf));
  for (const assessment of assessments) {
    if (assessment.status !== 'reported_passable') add('ROAD_REQUIRES_VERIFICATION',
      `${assessment.segmentId} is ${assessment.status}; it cannot support this proposal.`, assessment.evidenceIds);
    else if (assessment.independentOrigins < mission.minimumIndependentOrigins) add('INSUFFICIENT_ORIGINS',
      `${assessment.segmentId} has ${assessment.independentOrigins} independent origin; policy requires ${mission.minimumIndependentOrigins}.`, assessment.evidenceIds);
    const projected = world.assess(assessment.segmentId, arrivalAt);
    if (projected.status !== 'reported_passable' || projected.independentOrigins < mission.minimumIndependentOrigins) {
      add('EVIDENCE_EXPIRES_BEFORE_DELIVERY', `${assessment.segmentId} lacks enough unexpired supporting reports through delivery.`, assessment.evidenceIds);
    }
  }
  return { eligible: violations.length === 0, violations, assessments,
    calculations: { cargoKg, grossKg, requiredFuelLitres, arrivalAt } };
}

export async function validateRelief(mission: ReliefMission, candidate: ReliefCandidate | undefined,
  snapshot: ReliefSnapshot): Promise<Validation> {
  const result = await validateCandidate(mission, candidate, snapshot);
  if (!result.eligible || !candidate) return result;
  // Exhaustive comparison of this small, predefined candidate set. No claim of
  // global route optimality, and no model-generated arithmetic or road geometry.
  const earlier = snapshot.candidates.filter(c => c.travelMinutes < candidate.travelMinutes)
    .sort((a, b) => a.travelMinutes - b.travelMinutes);
  for (const alternative of earlier) {
    if ((await validateCandidate(mission, alternative, snapshot)).eligible) {
      return { ...result, eligible: false, violations: [{ code: 'EARLIER_ELIGIBLE_CANDIDATE',
        message: `${alternative.routeId} with ${alternative.vehicleId} meets the constraints and delivers ${candidate.travelMinutes - alternative.travelMinutes} minutes earlier.`,
        evidenceIds: alternative.evidenceIds }] };
    }
  }
  return result;
}
