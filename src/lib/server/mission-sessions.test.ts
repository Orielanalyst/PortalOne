// @vitest-environment node
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,rmdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {MissionJournal} from './mission-journal';
import {MissionRuntime} from './mission-runtime';
import {CommunityMap} from './community-map';
import {FixtureCommunityEvidence} from './community-evidence';
import {FixtureMissionLogistics} from './mission-logistics';
import {replayCommunitySource,replayDispatcher} from './mission-replay';
import type {ConversationContext,MissionConversation} from './mission-conversation';

const result={disposition:'hold' as const,summary:'Synthetic test findings; field confirmation missing.',gaps:['No field clearance.'],signalIds:[],placeIds:[],demoReports:0,liveReports:0};
function fixture(respond:MissionConversation['respond']) {
  const journal=new MissionJournal(':memory:');
  const source={origin:null,snapshot:vi.fn(()=>replayCommunitySource.snapshot())};
  const runtime=new MissionRuntime({journal,source,conversation:{respond},dispatcher:replayDispatcher,
    evidence:new FixtureCommunityEvidence(new CommunityMap()),logistics:new FixtureMissionLogistics()});
  return {journal,runtime,source};
}
const reply={action:'reply' as const,reply:'What mission would you like to prepare?',mission:null};

it('shows only evidence observed by the selected running investigation, rather than the global report cache',async()=>{
  const f=fixture(async()=>reply);
  try{
    const snapshot=await replayCommunitySource.snapshot();f.journal.ingest(snapshot);
    const session=f.runtime.newSession(),run=f.journal.startRun('A new investigation','test',session.id);
    expect(f.runtime.state(run.id,session.id).signals).toEqual([]);
    const observed=snapshot.records[0]!.signal.id;
    f.journal.event(run.id,'expert','tool_completed','One report observed.',[observed]);
    expect(f.runtime.state(run.id,session.id).signals.map(signal=>signal.id)).toEqual([observed]);
  }finally{f.runtime.stopMonitor();f.journal.close();}
});

it('starts a clean conversation and never supplies another mission history, inputs or findings to the model',async()=>{
  const contexts:ConversationContext[]=[];
  const f=fixture(async context=>{contexts.push(context);return context.message==='Prepare for 200 people.'?
    {...reply,missionPatch:{beneficiaries:{value:200,support:'200 people'}}}:reply;});
  try {
    const first=f.runtime.state().session;
    await f.runtime.chat('Prepare for 200 people.',0,first.id);
    const run=f.journal.startRun('First mission investigation','test',first.id);f.journal.finish(run.id,result);
    const firstDocument=f.journal.beginDocument({runId:run.id,actor:'planner',kind:'plan',title:'First mission plan'});
    f.journal.appendDocument(firstDocument,'First mission document.');f.journal.finishDocument(firstDocument,'published');
    const second=f.runtime.newSession();
    expect(f.runtime.state(undefined,second.id)).toMatchObject({selected:null,runs:[],conversation:[],documents:[],requirements:null,signals:[],reviews:[]});
    await f.runtime.chat('Hello, a different mission.',0,second.id);
    expect(contexts[1]).toMatchObject({history:[],lastInvestigation:null,requirements:null});
    expect(f.runtime.state(undefined,second.id).documents.every(doc=>doc.id!==firstDocument)).toBe(true);
    const restored=f.runtime.state(undefined,first.id);
    expect(restored.conversation.map(turn=>turn.message)).toEqual(['Prepare for 200 people.']);
    expect(restored.requirements?.values.beneficiaries).toBe(200);
    expect(restored.documents.map(doc=>doc.id)).toContain(firstDocument);
    expect(f.source.snapshot).not.toHaveBeenCalled();
  }finally{f.runtime.stopMonitor();f.journal.close();}
});

it('rejects a model patch that attempts to cite a statement from another mission',async()=>{
  const f=fixture(async context=>context.message==='200 people'?
    {...reply,missionPatch:{beneficiaries:{value:200,support:'200 people'}}}:
    {...reply,missionPatch:{beneficiaries:{value:200,support:'200 people'}}});
  try {
    const first=f.runtime.state().session;await f.runtime.chat('200 people',0,first.id);
    const second=f.runtime.newSession();const turn=await f.runtime.chat('Hello',0,second.id);
    expect(turn.reply).toContain('Please confirm');
    expect(f.journal.requirements(second.id)).toBeNull();
    expect(f.journal.requirements(first.id)?.values.beneficiaries).toBe(200);
  }finally{f.runtime.stopMonitor();f.journal.close();}
});

it('scopes reply documents and summaries and rejects cross-thread run selection',async()=>{
  const f=fixture(async()=>reply);
  try {
    const first=f.runtime.state().session;const a=await f.runtime.chat('First mission',0,first.id);
    const run=f.journal.startRun('Investigate first','test',first.id);f.journal.finish(run.id,result);
    f.journal.beginConversationSummary(run.id);f.journal.finishConversationSummary(run.id,'First mission only.',null);
    const second=f.runtime.newSession();await f.runtime.chat('Second mission',0,second.id);
    const view=f.runtime.state(undefined,second.id);
    expect(view.conversationSummaries).toEqual([]);
    expect(view.documents.some(doc=>doc.turnId===a.id)).toBe(false);
    expect(()=>f.runtime.state(run.id,second.id)).toThrow('different mission');
    expect(f.runtime.state(run.id).session.id).toBe(first.id);
    await expect(f.runtime.chat('Hello',0,'session-00000000-0000-0000-0000-000000000000')).rejects.toThrow('not found');
  }finally{f.runtime.stopMonitor();f.journal.close();}
});

it('migrates legacy sessions without losing their documents or inputs and preserves an empty new mission after restart',()=>{
  const dir=mkdtempSync(join(tmpdir(),'reliefintel-session-')),file=join(dir,'journal.sqlite');
  let journal=new MissionJournal(file);
  try {
    const turn=journal.beginConversation('A legacy mission','offline-replay');journal.finishConversation(turn.id,'Saved reply','reply');
    const run=journal.startRun('Legacy run','test',turn.sessionId);journal.finish(run.id,result);
    journal.close();const db=new DatabaseSync(file);db.exec('DROP TABLE mission_sessions');db.close();
    journal=new MissionJournal(file);
    expect(journal.sessions()).toHaveLength(1);expect(journal.conversation(turn.sessionId)[0]?.reply).toBe('Saved reply');
    expect(journal.recent(turn.sessionId)[0]?.id).toBe(run.id);
    const empty=journal.createSession();journal.close();journal=new MissionJournal(file);
    expect(journal.defaultSession().id).toBe(empty.id);expect(journal.conversation(empty.id)).toEqual([]);
    expect(journal.session(turn.sessionId)?.runCount).toBe(1);
  }finally{journal.close();for(const suffix of ['','-wal','-shm'])rmSync(file+suffix,{force:true});rmdirSync(dir);}
});

it('does not let other sessions push a mission out of its bounded run history',()=>{
  const journal=new MissionJournal(':memory:');
  try {
    const first=journal.createSession(),saved=journal.startRun('Saved mission','test',first.id);journal.finish(saved.id,result);
    for(let i=0;i<25;i++){const other=journal.createSession();const run=journal.startRun('Unrelated case','test',other.id);journal.finish(run.id,result);}
    expect(journal.recent(first.id).map(run=>run.id)).toEqual([saved.id]);
  }finally{journal.close();}
});

it('blocks new missions while work is active and stops a prior watch without deleting history',async()=>{
  const f=fixture(async()=>reply);
  try {
    const first=f.runtime.state().session;
    const run=f.runtime.start('Investigate Bambili demonstration reports',30,'operator',first.id);
    expect(()=>f.runtime.newSession()).toThrow('active work');
    await vi.waitFor(()=>expect(f.runtime.state().activeRunId).toBeNull());
    expect(f.runtime.state(undefined,first.id).monitorUntil).not.toBeNull();
    const next=f.runtime.newSession();expect(f.runtime.state(undefined,next.id).monitorUntil).toBeNull();
    expect(f.runtime.state(undefined,first.id).monitorUntil).toBeNull();
    expect(f.journal.run(run)).not.toBeNull();expect(f.journal.events(run).some(event=>event.kind==='monitor_stopped')).toBe(true);
  }finally{f.runtime.stopMonitor();f.journal.close();}
});
