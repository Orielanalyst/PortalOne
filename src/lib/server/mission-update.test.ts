// @vitest-environment node
import {MissionRuntime} from './mission-runtime';
import {MissionJournal} from './mission-journal';
import {MissionWorld} from './mission-world';
import {CommunityMap} from './community-map';
import {FixtureCommunityEvidence} from './community-evidence';
import {replayCommunitySource,replayDispatcher} from './mission-replay';
import {normalizeKobo} from './kobo';
import {runCommitteeMission} from './committee-mission';
import type {CommitteeWriter,CommitteeExporter} from './committee-mission';
const map=new CommunityMap();
const writer:CommitteeWriter={async stream(prompt,mode,options){
  const id=prompt.match(/"id":"(E[a-f0-9]{10})"/)![1];
  const action=prompt.includes('Why this mission requires a fresh review')?'Recheck the changed evidence before committee review.':'Confirm the evidence before committee review.';
  const paragraph=`${action} Field and resource confirmations remain required before an operational decision. [${id}]`;
  const verdict=prompt.includes('Start with ## Evaluation')?`**Verdict: ${prompt.includes('Evaluation of plan v1')?'REVISE':'ACCEPT_WITH_GAPS'}** [${id}]\n\n`:'';
  const content=`## Review draft\n\n${verdict}${paragraph}\n\n## Next actions\n\n${paragraph}`;
  options.onDelta(content.slice(0,40));await Promise.resolve();options.onDelta(content.slice(40));
  return {content,requestedMode:mode,responseModel:'explicit-unit-fixture',usage:undefined,durationMs:1,firstDeltaMs:0,deltas:2};
}};
async function changedSnapshot() {
  const base=await replayCommunitySource.snapshot(),now=new Date().toISOString();
  return {...base,count:base.count+1,checkedAt:now,records:[...base.records,normalizeKobo({_id:999,_uuid:'unit-forward',report_mode:'demo',observed_at:now,
    place_name:'Bambili',category:'road_blockage',source_relation:'forwarded',report_text:'DEMONSTRATION ONLY: unit fixture; no field incident asserted.'},'replay-v1',now)]};
}
const exporter:CommitteeExporter=async({journal,dossier,validateEvidence})=>{
  await validateEvidence();
  journal.saveBundle({runId:dossier.runId,revision:dossier.revision,status:'ready',files:[],note:'Explicit unit export fixture; no native PDF/GIS generation.',createdAt:new Date().toISOString()});
};
it('automatically replaces a watched committee pack, preserving old drafts, engine changes and cross-mission diff',async()=>{
  const journal=new MissionJournal(':memory:');let current=await replayCommunitySource.snapshot();
  const world=new MissionWorld();
  const runtime=new MissionRuntime({journal,world,source:{origin:null,snapshot:async()=>current},dispatcher:replayDispatcher,
    committeeWriter:writer,committeeExporter:exporter,evidence:new FixtureCommunityEvidence(map),pollIntervalMs:10});
  try {
    const first=runtime.start('Prepare a Bambili committee pack\nArea: Bambili',30,'operator',undefined,'committee');
    await vi.waitFor(()=>expect(runtime.state().activeRunId).toBeNull());
    const before=journal.documents(first).filter(document=>document.runId===first && document.kind==='plan');
    expect(journal.bundle(first)?.status).toBe('ready');expect(world.view(first).plans).toHaveLength(2);
    current=await changedSnapshot();
    await vi.waitFor(()=>{expect(journal.recent()).toHaveLength(2);expect(runtime.state().activeRunId).toBeNull();},{timeout:5000});
    runtime.stopMonitor();
    const next=journal.recent()[0]!;
    expect(next.cause).toBe('source_change');expect(journal.currency(first)).toMatchObject({status:'superseded',replacementRunId:next.id});
    expect(journal.currency(next.id)).toMatchObject({status:'snapshot',previousRunId:first});expect(journal.bundle(next.id)?.status).toBe('ready');
    expect(journal.bundle(next.id)?.revision).not.toBe(journal.bundle(first)?.revision);
    expect(world.view(first).plans.every(plan=>plan.status==='invalidated')).toBe(true);
    expect(world.view(first).plans.at(-1)?.changes.some(change=>change.label==='Forwarded records')).toBe(true);
    expect(journal.documents(first).filter(document=>document.runId===first && document.kind==='plan')).toEqual(before);
    const diff=journal.documents(next.id).find(document=>document.metadata['fromRunId']===first);
    expect(diff?.markdown).toContain('-Confirm the evidence');expect(diff?.markdown).toContain('+Recheck the changed evidence');
    expect(journal.citations(next.id).some(citation=>citation.kind==='memory')).toBe(true);
    expect(next.result?.liveReports).toBe(0);expect(next.result?.disposition).toBe('hold');
  }finally{runtime.stopMonitor();journal.close();}
});
it.each(['before_export','before_publish'])('refuses publication when evidence changes %s',async phase=>{
  const journal=new MissionJournal(':memory:'),baseline=await replayCommunitySource.snapshot(),changed=await changedSnapshot();let reads=0,published=false;
  try {
    const run=journal.startRun('Prepare a Bambili committee pack','test');
    const result=await runCommitteeMission({run,journal,map,writer,evidence:new FixtureCommunityEvidence(map),
      readSource:async()=>++reads>=(phase==='before_export'?4:5)?changed:baseline,
      exporter:async({validateEvidence})=>{await validateEvidence();published=true;}});
    expect(published).toBe(false);expect(journal.bundle(run.id)).toBeNull();
    expect(result.summary).toContain('Evidence changed during preparation');expect(journal.currency(run.id).status).toBe('superseded');
  }finally{journal.close();}
});
