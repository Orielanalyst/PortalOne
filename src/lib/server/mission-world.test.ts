// @vitest-environment node
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MissionWorld} from './mission-world';
import {CommunityMap} from './community-map';
import {FixtureCommunityEvidence,hashEvidence} from './community-evidence';
import {replayCommunitySource} from './mission-replay';
import {applyMissionPatch,withMissionRequirements} from './mission-requirements';
import {MissionJournal} from './mission-journal';

async function evidence() {return new FixtureCommunityEvidence(new CommunityMap()).load(await replayCommunitySource.snapshot(),AbortSignal.timeout(1000));}
it('persists actual engine dependencies, invalidates on changed facts and never resurrects an old plan',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'reliefintel-mission-world-'));
  try {
    const world=new MissionWorld({directory}),baseline=await evidence();
    await world.observe(baseline,'mission-one');
    const recorded=await world.recordPlan({runId:'mission-one',documentId:'plan-one',version:1,evidence:baseline});
    expect(recorded.eventIds).toHaveLength(2); // entity plus dependency relationship in the acquired engine
    expect(world.view('mission-one').audit.some(entry=>entry.eventId===recorded.eventIds[0])).toBe(true);
    const changed=structuredClone(baseline);changed.reportCount++;changed.demoCount++;changed.forwardedCount++;
    changed.revision=hashEvidence({prior:baseline.revision,forwarded:changed.forwardedCount});changed.fetchedAt=new Date().toISOString();
    const update=await world.observe(changed,'mission-two');
    expect(update.invalidated).toHaveLength(1);
    expect(update.invalidated[0]?.changes).toContainEqual({label:'Forwarded records',before:baseline.forwardedCount,after:changed.forwardedCount});
    const restored=new MissionWorld({directory});
    expect(restored.view('mission-one').plans[0]?.status).toBe('invalidated');
    expect(restored.view('mission-one').events.some(event=>update.eventIds.includes(event.id))).toBe(true);
    await restored.observe(baseline,'mission-three');
    expect(restored.view('mission-one').plans[0]?.status).toBe('invalidated');
    expect(restored.view('mission-one').plans[0]?.changes.some(change=>change.label.includes('verified origins'))).toBe(false);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
it('ignores fresh query receipts and fetch timestamps, and isolates a different project',async()=>{
  const world=new MissionWorld(),baseline=await evidence();
  await world.observe(baseline,'mission-one');await world.recordPlan({runId:'mission-one',documentId:'plan-one',version:1,evidence:baseline});
  await world.recordPlan({runId:'mission-one',documentId:'plan-two',version:2,evidence:baseline});
  expect(world.view('mission-one').plans.map(plan=>plan.version)).toEqual([1,2]);
  const eventCount=world.view('mission-one').events.length;
  expect(await world.observe({...baseline,fetchedAt:new Date().toISOString(),queries:[]},'mission-one')).toMatchObject({changed:false,eventIds:[],invalidated:[]});
  await world.observe({...baseline,sourceId:'another-project',revision:'another-revision'},'mission-other');
  expect(world.view('mission-one').plans[0]?.status).toBe('recorded');
  expect(world.view('mission-one').events).toHaveLength(eventCount);
});
it('invalidates on logistics freshness drift without needing a new report and refuses conflicting snapshot reuse',async()=>{
  const world=new MissionWorld(),baseline=await evidence();
  await world.observe(baseline,'mission-one');await world.recordPlan({runId:'mission-one',documentId:'plan-one',version:1,evidence:baseline});
  const changed=structuredClone(baseline);changed.rows[0]!.stockFresh=!changed.rows[0]!.stockFresh;
  await expect(world.observe(changed,'mission-one')).rejects.toThrow('revision reused');
  changed.revision=hashEvidence(changed.rows);
  const drift=await world.observe(changed,'mission-one');
  expect(drift.invalidated[0]?.changes.some(change=>change.label.includes('stock freshness'))).toBe(true);
  await expect(world.recordPlan({runId:'mission-one',documentId:'late-plan',version:2,evidence:baseline})).rejects.toThrow('Evidence changed');
});
it('isolates different mission requirements but invalidates all affected missions when their shared source changes',async()=>{
  const world=new MissionWorld(),journal=new MissionJournal(':memory:'),base=await evidence();
  try {
    const a=journal.updateRequirements('session-a',{quantity:{value:10,support:'10 kits'}},['10 kits'],'turn-a');
    const b=journal.updateRequirements('session-b',{quantity:{value:20,support:'20 kits'}},['20 kits'],'turn-b');
    const ea=withMissionRequirements(base,a),eb=withMissionRequirements(base,b);
    const ra=journal.startRun('Mission A','test','session-a'),rb=journal.startRun('Mission B','test','session-b');
    await world.observe(ea,ra.id);await world.recordPlan({runId:ra.id,documentId:'plan-a',version:1,evidence:ea});
    const aa=journal.recordAssessment(ra.id,ea,{placeId:null,nextAction:'clarify_mission',rationale:'Fixture A'});journal.checkAssessment(aa,ea);
    await world.observe(eb,rb.id);await world.recordPlan({runId:rb.id,documentId:'plan-b',version:1,evidence:eb});
    const ab=journal.recordAssessment(rb.id,eb,{placeId:null,nextAction:'clarify_mission',rationale:'Fixture B'});journal.checkAssessment(ab,eb);
    expect(world.view(ra.id).plans[0]?.status).toBe('recorded');expect(journal.assessments(ra.id)[0]?.status).toBe('checked');
    const changed=journal.updateRequirements('session-a',{quantity:{value:30,support:'30 kits'}},['30 kits'],'turn-a2');
    const update=withMissionRequirements(base,changed);await world.observe(update,ra.id);journal.observeEvidence(update);
    expect(world.view(ra.id).plans[0]?.status).toBe('invalidated');expect(world.view(rb.id).plans[0]?.status).toBe('recorded');
    expect(journal.assessments(rb.id)[0]?.status).toBe('checked');
    const sourceChange={...base,reportCount:base.reportCount+1,revision:hashEvidence('changed-public-or-community-source')};
    const newB=withMissionRequirements(sourceChange,b);await world.observe(newB,rb.id);journal.observeEvidence(newB);
    expect(world.view(rb.id).plans[0]?.status).toBe('invalidated');expect(journal.assessments(rb.id)[0]?.status).toBe('invalidated');
  }finally{journal.close();}
});
