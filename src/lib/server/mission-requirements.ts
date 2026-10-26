import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import type { FederatedEvidence } from './community-evidence';
import {createRequire} from 'node:module';
const requireDateParser=createRequire(import.meta.url);
type DateParser=typeof import('chrono-node')['parse'];
let englishDateParser:DateParser|undefined,frenchDateParser:DateParser|undefined;

const text = z.string().trim().min(1).max(160), count = z.number().int().nonnegative().max(1_000_000), positive = z.number().positive().max(1_000_000);
export const MissionValuesSchema = z.object({
  mode: z.enum(['demonstration', 'operator_reported']), origin: text, destination: text, beneficiaries: count,
  cargoLabel: text, quantity: count.refine(n => n > 0), unitMassKg: positive,
  departAt: z.iso.datetime({ offset: true }), deadline: z.iso.datetime({ offset: true }),
  stockUnits: count, stockObservedAt: z.iso.datetime({ offset: true }), stockValidUntil: z.iso.datetime({ offset: true }),
  vehicleName: text, payloadKg: positive, tareKg: positive, fuelLitres: z.number().nonnegative().max(100_000), litresPerKm: positive,
  fourWheelDrive: z.boolean(), vehicleAvailable: z.boolean(),
  vehicleObservedAt: z.iso.datetime({ offset: true }), vehicleValidUntil: z.iso.datetime({ offset: true }),
  planningSpeedKph: positive.max(120), handlingMinutes: z.number().nonnegative().max(10_000), bufferMinutes: z.number().nonnegative().max(10_000),
  fuelReserveLitres: z.number().nonnegative().max(100_000),
}).strict();
export type MissionValues = z.infer<typeof MissionValuesSchema>;
export type MissionField = keyof MissionValues;
export const missionFields = Object.keys(MissionValuesSchema.shape) as MissionField[];
export const fieldLabels: Record<MissionField, string> = {
  mode: 'demonstration or operator-reported mode', origin: 'origin community', destination: 'destination community', beneficiaries: 'beneficiary count',
  cargoLabel: 'cargo description', quantity: 'cargo unit count', unitMassKg: 'mass per unit in kg', departAt: 'departure timestamp with timezone', deadline: 'delivery deadline with timezone',
  stockUnits: 'available stock units', stockObservedAt: 'stock confirmation timestamp', stockValidUntil: 'stock confirmation expiry',
  vehicleName: 'vehicle reference', payloadKg: 'vehicle payload limit in kg', tareKg: 'vehicle empty mass in kg', fuelLitres: 'available vehicle fuel in litres',
  litresPerKm: 'vehicle fuel burn in litres per km', fourWheelDrive: 'four-wheel-drive availability', vehicleAvailable: 'vehicle availability',
  vehicleObservedAt: 'vehicle confirmation timestamp', vehicleValidUntil: 'vehicle confirmation expiry',
  planningSpeedKph: 'assumed planning speed in km/h', handlingMinutes: 'handling time in minutes', bufferMinutes: 'time buffer in minutes', fuelReserveLitres: 'fixed fuel reserve in litres',
};
const supportedValue = (schema: z.ZodType) => z.object({ value: (schema instanceof z.ZodNumber
  ? z.preprocess(value=>typeof value==='string' && /^\d+(?:\.\d+)?$/.test(value)?Number(value):value,schema):schema).nullable(), support: z.string().min(1).max(500) }).strict();
const timeFields=new Set<MissionField>(['departAt','deadline','stockObservedAt','stockValidUntil','vehicleObservedAt','vehicleValidUntil']);
export const MissionPatchSchema = z.object(Object.fromEntries(missionFields.map(key => [key, supportedValue(timeFields.has(key)?text:MissionValuesSchema.shape[key]).optional()]))).strict();
export type MissionPatch = Partial<{ [K in MissionField]: { value: MissionValues[K] | null; support: string } }>;
export type MissionRequirements = { id: string; version: number; values: Partial<MissionValues>; revision: string;
  sources: Partial<Record<MissionField, { turnId: string; support: string;normalization?:{referenceAt:string;timeZone:string} }>>; updatedAt: string };
export const missionDigest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export type UserInputSource=string|{text:string;at:string;turnId:string};
export class MissionInputError extends Error {constructor(readonly field:MissionField,message:string){super(message);}}
export function normalizeMissionTime(value:string,referenceAt:string):string {
  if(z.iso.datetime({offset:true}).safeParse(value).success)return new Date(value).toISOString();
  if(/^\d{4}-\d{2}-\d{2}T/.test(value))throw new Error('An ISO timestamp needs an explicit timezone.');
  const phrase=value.replace(/\b(?:Cameroon|Douala)(?: local)? time\b/gi,'').trim();
  const reference={instant:new Date(referenceAt),timezone:60};
  englishDateParser ??= (requireDateParser('chrono-node/en') as {parse:DateParser}).parse;
  const results=englishDateParser(phrase,reference);
  if(!results.length)frenchDateParser ??= (requireDateParser('chrono-node/fr') as {parse:DateParser}).parse;
  const matches=results.length?results:frenchDateParser!(phrase,reference);
  if(matches.length!==1 || matches[0]!.end || !matches[0]!.start.isCertain('day') || !matches[0]!.start.isCertain('hour'))throw new Error('Give one explicit date and time, such as tomorrow at 9am Cameroon time; a time or morning alone is ambiguous.');
  const date=matches[0]!.start.date();if(!Number.isFinite(date.getTime()))throw new Error('The mission time could not be normalized.');
  return date.toISOString();
}
export function applyMissionPatch(previous: MissionRequirements | null, patchInput: unknown, messages: UserInputSource[], turnId: string): MissionRequirements {
  const patch = MissionPatchSchema.parse(patchInput) as MissionPatch;
  const values = { ...previous?.values }, sources = { ...previous?.sources };
  for (const key of missionFields) {
    const entry = patch[key]; if (!entry) continue;
    const source=[...messages].reverse().map(message=>typeof message==='string'?{text:message,at:new Date().toISOString(),turnId}:message).find(message=>message.text.includes(entry.support));
    if (!source) throw new MissionInputError(key,'Mission input lacks an exact user-message source.');
    let value = entry.value;let normalization: {referenceAt:string;timeZone:string}|undefined;
    const quote = entry.support.toLowerCase();
    if (value === null) {
      if (!/clear|remove|unknown|unsure|not known|not available|reset/i.test(quote)) throw new MissionInputError(key,'Clearing a mission value requires an explicit user statement.');
      delete values[key]; delete sources[key]; continue;
    }
    if (typeof value === 'number') {
      const numbers = quote.replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1').match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      if (!numbers.includes(value)) throw new MissionInputError(key,'Mission number is not present in its user-message support.');
      if(['unitMassKg','payloadKg','tareKg'].includes(key) && !/kg|kilogram/.test(quote))throw new MissionInputError(key,'Supply the mass in kilograms with its unit.');
      if(['fuelLitres','fuelReserveLitres','litresPerKm'].includes(key) && !/litre|liter|\d\s*l\b/.test(quote))throw new MissionInputError(key,'Supply fuel in litres with its unit.');
      if(key==='planningSpeedKph' && !/kph|km\s*\/\s*h|kmh|kilomet.*hour/.test(quote))throw new MissionInputError(key,'Supply the planning-speed assumption in kilometres per hour.');
      if(key==='litresPerKm' && /(?:\/|per)\s*100\s*k/i.test(quote))throw new MissionInputError(key,'Supply fuel burn per kilometre; a per-100-km value cannot be copied into that field.');
    } else if (typeof value === 'boolean') {
      const positive = key === 'fourWheelDrive' ? /\b4wd\b|four.wheel|\btrue\b|\byes\b/ : /\bavailable\b|\btrue\b|\byes\b/;
      const negative = /unavailable|not available|\bfalse\b|\bno\b|\b2wd\b|two.wheel/;
      if (value ? !positive.test(quote) || negative.test(quote) : !negative.test(quote)) throw new MissionInputError(key,'Mission boolean is not supported by the user statement.');
    } else if (key === 'mode') {
      if (value === 'demonstration' ? !/demo|exercise|synthetic|simulation/.test(quote) : !/operator.reported|real mission|actual mission/.test(quote)) throw new MissionInputError(key,'Mission mode was not explicitly supplied.');
    } else if (!quote.includes(String(value).toLowerCase())) throw new MissionInputError(key,'Mission field is not present in its user-message support.');
    if(timeFields.has(key)) {
      try{value=normalizeMissionTime(String(value),source.at);normalization={referenceAt:source.at,timeZone:'Africa/Douala (UTC+01:00) unless the source supplies an explicit offset'};}
      catch(error){throw new MissionInputError(key,error instanceof Error?error.message:'The date/time is ambiguous.');}
    }
    (values as Record<string, unknown>)[key] = value; sources[key] = { turnId:source.turnId, support: entry.support,...(normalization?{normalization}:{}) };
  }
  const revision = missionDigest(Object.fromEntries(missionFields.filter(key => values[key] !== undefined).map(key => [key, values[key]])));
  if (previous?.revision === revision) return previous;
  return { id: previous?.id ?? `mission-input-${randomUUID()}`, version: (previous?.version ?? 0) + 1, values, sources, revision, updatedAt: new Date().toISOString() };
}
export function missingMissionInputs(profile: Pick<MissionRequirements,'values'> | null): MissionField[] {
  return missionFields.filter(key => profile?.values[key] === undefined);
}
export function publicRequirements(profile: MissionRequirements | null) {
  return profile ? { id: profile.id, version: profile.version, values: profile.values, revision: profile.revision, updatedAt: profile.updatedAt,
    provenance: Object.fromEntries(Object.entries(profile.sources).map(([field, source]) => [field, { turnId: source.turnId, quoteSha256: missionDigest(source.support),...(source.normalization?{normalization:source.normalization}:{}) }])),
    missing: missingMissionInputs(profile).map(key => ({ field: key, label: fieldLabels[key] })),
    limitation: 'Operator-supplied requirements and resource statements are not an independently verified warehouse/fleet ledger. Supporting user-message quotes remain local.' } : null;
}
export function withMissionRequirements(evidence:FederatedEvidence,profile:MissionRequirements|null):FederatedEvidence {
  if(!profile)return evidence;
  const now=Date.now(),value=profile.values;
  const fresh=(from:string|undefined,until:string|undefined)=>Boolean(from && until && Date.parse(from)<=now && Date.parse(until)>now);
  const resourceFreshness={stock:fresh(value.stockObservedAt,value.stockValidUntil),vehicle:fresh(value.vehicleObservedAt,value.vehicleValidUntil),
    departureFuture:Boolean(value.departAt && Date.parse(value.departAt)>now),deadlineFuture:Boolean(value.deadline && Date.parse(value.deadline)>now)};
  return {...evidence,dependencyBaseRevision:evidence.dependencyBaseRevision ?? evidence.revision,requirements:publicRequirements(profile),inputRevision:missionDigest({base:evidence.inputRevision,requirements:profile.revision}),
    revision:missionDigest({base:evidence.revision,requirements:profile.revision,resourceFreshness})};
}
