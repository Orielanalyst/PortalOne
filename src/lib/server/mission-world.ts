import { WorldModel, canonicalJson, externalId, sha256Hex } from '../../../vendor/meterless-world-model/dist/index.js';
import type { AuditEntry } from '../../../vendor/meterless-world-model/dist/index.js';
import type { FederatedEvidence } from './community-evidence';
import type { MissionJournal } from './mission-journal';
import {fieldLabels} from './mission-requirements';
import type {MissionField} from './mission-requirements';

type Value = string | number | boolean | null;
export type MemoryChange = { label: string; before: Value; after: Value };
type Assumption = { key: string; label: string; value: Value };
type EvidenceMemory = { id: string; sourceKey: string; revision: string; inputRevision: string; assumptions: Assumption[]; at: string };
export type MissionPlanMemory = { id: string; runId: string; documentId: string; version: number; sourceKey: string;
  baseSourceKey?:string;baseRevision?:string;
  evidenceId: string; revision: string; status: 'recorded' | 'invalidated'; recordedAt: string;
  invalidatedAt: string | null; changedToRevision: string | null; changes: MemoryChange[] };
export type MissionMemoryView = { engine: 'Meterless World Model'; namespace: string; plans: MissionPlanMemory[];
  events: { id: string; seq: number; kind: string; at: string }[]; audit:AuditEntry[] };

function assumptions(evidence: FederatedEvidence): Assumption[] {
  const result: Assumption[] = [
    {key:'input',label:'Report/map input revision',value:evidence.inputRevision},
    ...(['reportCount','demoCount','liveCount','forwardedCount'] as const).map(key=>({key,label:({reportCount:'Report records',demoCount:'Demonstration records',liveCount:'Live-labelled records',forwardedCount:'Forwarded records'})[key],value:evidence[key]})),
  ];
  if(evidence.cartographyRevision)result.push({key:'map:cartography',label:'Administrative reference geometry revision',value:evidence.cartographyRevision});
  if(evidence.publicEvidence)result.push(
    {key:'public:revision',label:'Public-source content revision',value:evidence.publicEvidence.revision},
    {key:'public:status',label:'Public-source availability',value:evidence.publicEvidence.status},
    {key:'public:reports',label:'Eligible public reports',value:evidence.publicEvidence.reports.length});
  if(evidence.requirements){result.push({key:'mission:requirements',label:'Operator mission requirements revision',value:evidence.requirements.revision});
    for(const [field,value] of Object.entries(evidence.requirements.values))result.push({key:`mission:input:${field}`,label:`Mission ${fieldLabels[field as MissionField]}`,value:value as Value});}
  const fields = {reports:'report records',blockers:'reported access constraints',verifiedOrigins:'verified origins',ambiguous:'ambiguous matches',
    stockUnits:'recorded stock',stockFresh:'stock freshness',stockValidUntil:'stock expiry',availableVehicles:'recorded available vehicles',
    fleetFresh:'fleet freshness',fleetValidUntil:'fleet expiry',logisticsSimulated:'synthetic logistics'} as const;
  for (const row of evidence.rows) for (const [field,label] of Object.entries(fields)) {
    result.push({key:`${row.placeId}:${field}`,label:`${row.name}: ${label}`,value:row[field as keyof typeof fields]});
  }
  return result.sort((a,b)=>a.key.localeCompare(b.key));
}
function differences(before: Assumption[], after: Assumption[]): MemoryChange[] {
  const left=new Map(before.map(item=>[item.key,item])),right=new Map(after.map(item=>[item.key,item]));
  return [...new Set([...left.keys(),...right.keys()])].sort().flatMap(key=>{
    const a=left.get(key),b=right.get(key);
    return a?.value===b?.value ? [] : [{label:b?.label ?? a!.label,before:a?.value ?? null,after:b?.value ?? null}];
  });
}
export const describeMemoryChange = (change:MemoryChange) => `${change.label}: ${change.before ?? 'unknown'} → ${change.after ?? 'unknown'}`;

/** Acquired event-sourced engine; only compact normalized facts enter this memory. */
export class MissionWorld {
  readonly namespace: string;
  private readonly model: WorldModel;
  private writes: Promise<unknown> = Promise.resolve();
  constructor(options:{namespace?:string;directory?:string}={}) {
    this.namespace=options.namespace ?? 'committee-memory';
    if(!/^[a-zA-Z0-9_-]{1,64}$/.test(this.namespace))throw new Error('Invalid mission memory namespace.');
    this.model=new WorldModel({namespace:this.namespace,storage:options.directory?'local':'memory',directory:options.directory});
  }
  private serialize<T>(operation:()=>Promise<T>):Promise<T> {
    const next=this.writes.then(operation);this.writes=next.catch(()=>undefined);return next;
  }
  private entity<T>(type:string,id:string):T|undefined {
    return this.model.view('graph').entity(externalId(type,'reliefintel-mission',id))?.attrs as T|undefined;
  }
  private plans() { return this.model.view('graph').query({type:'mission_plan'}).map(entity=>entity.attrs as MissionPlanMemory); }
  observe(evidence:FederatedEvidence,runId:string) {
    const input=structuredClone(evidence);
    return this.serialize(async()=>{
      const start=this.model.events().length,baseSourceKey=sha256Hex(input.sourceId),
        sourceKey=input.requirements?sha256Hex(canonicalJson({source:input.sourceId,mission:input.requirements.id})):baseSourceKey,id=`${sourceKey}:${input.revision}`;
      const data={sourceKey,revision:input.revision,inputRevision:input.inputRevision,assumptions:assumptions(input)};
      const known=this.entity<EvidenceMemory>('mission_evidence',id);
      if(known && canonicalJson({sourceKey:known.sourceKey,revision:known.revision,inputRevision:known.inputRevision,assumptions:known.assumptions})!==canonicalJson(data))throw new Error('Evidence revision reused for different mission facts.');
      const current=this.entity<{currentRevision:string}>('mission_source',sourceKey);
      if(current?.currentRevision===input.revision)return {changed:false,eventIds:[] as string[],invalidated:[] as MissionPlanMemory[]};
      const source={kind:'api' as const,by:input.mode==='live-zetaris'?'zetaris-community':'explicit-offline-fixture',at:input.fetchedAt,runId,checksum:sha256Hex(canonicalJson(data))};
      const snapshot=known ?? {id,...data,at:input.fetchedAt};
      await this.model.upsertEntity({type:'mission_base_source',externalKey:{system:'reliefintel-mission',id:baseSourceKey},attrs:{currentRevision:input.dependencyBaseRevision ?? input.revision},source});
      if(!known)await this.model.upsertEntity({type:'mission_evidence',externalKey:{system:'reliefintel-mission',id},attrs:snapshot,source});
      const head=await this.model.upsertEntity({type:'mission_source',externalKey:{system:'reliefintel-mission',id:sourceKey},attrs:{currentRevision:input.revision,currentEvidenceId:id},source});
      await this.model.relate({from:head.id,type:'current_evidence',to:externalId('mission_evidence','reliefintel-mission',id),validFrom:input.fetchedAt,source});
      const invalidated:MissionPlanMemory[]=[];
      for(const stored of this.plans().filter(plan=>plan.status==='recorded' &&
        (plan.sourceKey===sourceKey && plan.revision!==input.revision ||
          (plan.baseSourceKey ?? plan.sourceKey)===baseSourceKey &&
          (plan.baseRevision ?? plan.revision)!==(input.dependencyBaseRevision ?? input.revision)))) {
        const baseline=this.entity<EvidenceMemory>('mission_evidence',stored.evidenceId);
        const plan:MissionPlanMemory={...stored,status:'invalidated',invalidatedAt:input.fetchedAt,changedToRevision:input.revision,
          changes:baseline?differences(baseline.assumptions,snapshot.assumptions):[]};
        await this.model.upsertEntity({type:'mission_plan',externalKey:{system:'reliefintel-mission',id:plan.id},attrs:plan,source:{...source,by:'mission-assumption-review',runId:plan.runId}});
        invalidated.push(structuredClone(plan));
      }
      return {changed:true,eventIds:this.model.events().slice(start).map(event=>event.id),invalidated};
    });
  }
  recordPlan(input:{runId:string;documentId:string;version:number;evidence:FederatedEvidence}) {
    return this.serialize(async()=>{
      const existing=this.entity<MissionPlanMemory>('mission_plan',input.documentId);
      if(existing) {
        if(existing.revision!==input.evidence.revision || existing.runId!==input.runId)throw new Error('A published plan cannot change its evidence dependency.');
        return {plan:structuredClone(existing),eventIds:[] as string[]};
      }
      const baseSourceKey=sha256Hex(input.evidence.sourceId),sourceKey=input.evidence.requirements?sha256Hex(canonicalJson({source:input.evidence.sourceId,mission:input.evidence.requirements.id})):baseSourceKey,evidenceId=`${sourceKey}:${input.evidence.revision}`;
      if(!this.entity<EvidenceMemory>('mission_evidence',evidenceId))throw new Error('Record the evidence before its plan dependency.');
      const current=this.entity<{currentRevision:string}>('mission_source',sourceKey);
      if(current?.currentRevision!==input.evidence.revision)throw new Error('Evidence changed while the plan was being written.');
      if(this.entity<{currentRevision:string}>('mission_base_source',baseSourceKey)?.currentRevision!==(input.evidence.dependencyBaseRevision ?? input.evidence.revision))throw new Error('Shared source evidence changed while the plan was being written.');
      const start=this.model.events().length,at=new Date().toISOString();
      const plan:MissionPlanMemory={id:input.documentId,runId:input.runId,documentId:input.documentId,version:input.version,sourceKey,evidenceId,
        revision:input.evidence.revision,status:'recorded',recordedAt:at,invalidatedAt:null,changedToRevision:null,changes:[],
        ...{baseSourceKey,baseRevision:input.evidence.dependencyBaseRevision ?? input.evidence.revision}};
      const source={kind:'agent' as const,by:'mission-plan-dependencies',at,runId:input.runId};
      const entity=await this.model.upsertEntity({type:'mission_plan',externalKey:{system:'reliefintel-mission',id:plan.id},attrs:plan,source});
      await this.model.relate({from:entity.id,type:'depends_on',to:externalId('mission_evidence','reliefintel-mission',evidenceId),source});
      return {plan:structuredClone(plan),eventIds:this.model.events().slice(start).map(event=>event.id)};
    });
  }
  view(runId:string):MissionMemoryView {
    return {engine:'Meterless World Model',namespace:this.namespace,plans:structuredClone(this.plans().filter(plan=>plan.runId===runId).sort((a,b)=>a.version-b.version)),
      events:this.model.events().filter(event=>(event.payload as {source?:{runId?:string}}).source?.runId===runId)
        .map(({id,seq,kind,at})=>({id,seq,kind,at})),audit:structuredClone(this.model.audit().filter(entry=>entry.runId===runId))};
  }
}

export async function observeMissionEvidence(world:MissionWorld,journal:MissionJournal,evidence:FederatedEvidence,runId:string) {
  const result=await world.observe(evidence,runId);
  journal.observeEvidence(evidence);
  if(result.changed)journal.event(runId,'memory','world_evidence_recorded','Meterless World Model recorded a new evidence revision and reviewed published plan dependencies.',result.eventIds);
  for(const plan of result.invalidated)journal.event(plan.runId,'memory','world_plan_invalidated',
    `Meterless World Model invalidated plan v${plan.version}: ${plan.changes.filter(change=>change.label!=='Report/map input revision').slice(0,5).map(describeMemoryChange).join('; ') || 'the report/map evidence revision changed'}. Fresh independent review is required.`,[plan.documentId,...result.eventIds]);
  return result;
}
