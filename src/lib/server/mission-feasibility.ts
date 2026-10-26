import { MissionValuesSchema, missingMissionInputs, missionDigest } from './mission-requirements';
import type { MissionRequirements, MissionField } from './mission-requirements';
import { MappedRouter } from './mapped-route';
import type { MappedRoute } from './mapped-route';
import type { CommunityMap } from './community-map';
import { deliveryCalculations } from './relief-validator';

export type FeasibilityCheck = { code: string; status: 'pass' | 'fail' | 'unknown'; message: string; fields: MissionField[] };
export type MissionFeasibility = { id: string; requirementsRevision: string | null; status: 'needs_inputs' | 'infeasible' | 'conditional';
  checkedAt: string; missing: { field: MissionField; label: string }[]; route: MappedRoute | null; checks: FeasibilityCheck[];
  calculations: (ReturnType<typeof deliveryCalculations> & { travelMinutes: number; distanceKm: number }) | null;
  validUntil: string | null; dispatchAuthorized: false; limitations: string[];
  accessRelationships?:{signalId:string;evidenceId:string;candidateRoadIds:string[];overlappingRoadIds:string[];relationship:'possible_route_overlap'|'no_displayed_overlap'|'unlocated';gap:string}[];
  alternativeRoute?:MappedRoute };
import { fieldLabels } from './mission-requirements';
const routers = new WeakMap<CommunityMap, MappedRouter>();
export function mappedRouter(map: CommunityMap) { let router = routers.get(map); if (!router) { router = new MappedRouter(map); routers.set(map, router); } return router; }

/** Deterministic tools calculate; the model may explain or propose verification, never fill the numbers. */
export function missionFeasibility(profile: Pick<MissionRequirements,'values'|'revision'> | null, map: CommunityMap, options: { now?: string; avoidRoadIds?: string[] } = {}): MissionFeasibility {
  const now = options.now ?? new Date().toISOString(), missing = missingMissionInputs(profile).map(field => ({ field, label: fieldLabels[field] }));
  const values = profile?.values ?? {}, checks: FeasibilityCheck[] = [];
  const route = values.origin && values.destination ? mappedRouter(map).route(values.origin, values.destination, options.avoidRoadIds) : null;
  const add = (code: string, pass: boolean, message: string, fields: MissionField[]) => checks.push({ code, status: pass ? 'pass' : 'fail', message, fields });
  let calculations: MissionFeasibility['calculations'] = null, validUntil: string | null = null;
  if (values.quantity !== undefined && values.stockUnits !== undefined) add('STOCK', values.quantity <= values.stockUnits, `Requested ${values.quantity} units; operator-reported stock ${values.stockUnits}.`, ['quantity', 'stockUnits']);
  if (values.quantity !== undefined && values.unitMassKg !== undefined && values.payloadKg !== undefined) add('PAYLOAD', values.quantity * values.unitMassKg <= values.payloadKg,
    `Cargo ${values.quantity * values.unitMassKg} kg; vehicle payload limit ${values.payloadKg} kg.`, ['quantity', 'unitMassKg', 'payloadKg']);
  if (values.vehicleAvailable !== undefined) add('VEHICLE_AVAILABLE', values.vehicleAvailable, `Operator reports the vehicle ${values.vehicleAvailable ? 'available' : 'unavailable'}.`, ['vehicleAvailable']);
  if (values.departAt) add('DEPARTURE', Date.parse(values.departAt) >= Date.parse(now), `Requested departure ${values.departAt}; checked at ${now}.`, ['departAt']);
  if (route) checks.push({ code: 'MAPPED_CONNECTION', status: route.status === 'mapped_candidate' ? 'pass' : 'fail', message: route.status === 'mapped_candidate'
    ? `Mapped graph candidate: ${route.distanceKm} km; community-to-road offsets ${route.originOffsetM} m and ${route.destinationOffsetM} m remain unverified.` : route.gaps[0]!, fields: ['origin', 'destination'] });
  if (!missing.length && route?.status === 'mapped_candidate' && route.distanceKm !== null) {
    const value = MissionValuesSchema.parse(values), travelMinutes = Math.ceil(route.distanceKm / value.planningSpeedKph * 60);
    calculations = { ...deliveryCalculations(value, { unitMassKg: value.unitMassKg, tareKg: value.tareKg, distanceKm: route.distanceKm,
      litresPerKm: value.litresPerKm, travelMinutes }, value.departAt), travelMinutes, distanceKm: route.distanceKm };
    add('FUEL', calculations.requiredFuelLitres <= value.fuelLitres,
      `Round trip with 50% fuel contingency and fixed reserve requires ${calculations.requiredFuelLitres.toFixed(2)} L; operator reports ${value.fuelLitres} L.`, ['fuelLitres', 'litresPerKm', 'fuelReserveLitres']);
    add('DEADLINE', Date.parse(calculations.arrivalAt) <= Date.parse(value.deadline), `Calculated arrival with handling/buffer ${calculations.arrivalAt}; deadline ${value.deadline}.`, ['departAt', 'deadline', 'planningSpeedKph', 'handlingMinutes', 'bufferMinutes']);
    for (const kind of ['stock', 'vehicle'] as const) {
      const from = value[kind === 'stock' ? 'stockObservedAt' : 'vehicleObservedAt'], until = value[kind === 'stock' ? 'stockValidUntil' : 'vehicleValidUntil'];
      add(`${kind.toUpperCase()}_FRESHNESS`, Date.parse(from) <= Date.parse(now) && Date.parse(from) <= Date.parse(value.departAt) && Date.parse(until) > Date.parse(calculations.arrivalAt),
        `${kind} statement observed ${from}, valid until ${until}; it must be current now and remain valid through the calculated delivery.`, kind === 'stock' ? ['stockObservedAt', 'stockValidUntil'] : ['vehicleObservedAt', 'vehicleValidUntil']);
    }
    validUntil = [value.stockValidUntil, value.vehicleValidUntil, value.deadline].sort((a, b) => Date.parse(a) - Date.parse(b))[0]!;
  }
  checks.push({ code: 'ROAD_FIELD_CONFIRMATION', status: 'unknown', message: 'Mapped connectivity does not establish present passability, bridge/gross-weight limits, access permission, surface suitability or independent field origins.', fields: [] });
  const status = checks.some(check => check.status === 'fail') ? 'infeasible' : missing.length || !calculations ? 'needs_inputs' : 'conditional';
  const result = { requirementsRevision: profile?.revision ?? null, status, checkedAt: now, missing, route, checks, calculations, validUntil, dispatchAuthorized: false as const,
    limitations: ['The fuel policy reuses the tested relief validator: round-trip distance, 50% contingency and an explicit fixed reserve. Travel time uses the operator-supplied planning speed; it is an assumption, not observed traffic.',
      'Reported stock, fleet and mission requirements retain user-message provenance; no independent warehouse/fleet confirmation is implied.',
      'A conditional calculation can support committee proposal review. Dispatch stays held for unresolved field, endpoint and operating constraints.', ...(route?.gaps ?? [])] };
  // Clock-only changes do not manufacture a new decision; expiry/status/check outcomes do.
  return { ...result, status: status as MissionFeasibility['status'], id: `feasibility-${missionDigest({ requirements: result.requirementsRevision, status, route: route?.id, checks: checks.map(c => [c.code, c.status]), calculations }).slice(0, 24)}` };
}
