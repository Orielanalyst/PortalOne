// @vitest-environment node
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MissionWorld} from './mission-world';
import {CommunityMap} from './community-map';
import {FixtureCommunityEvidence,hashEvidence} from './community-evidence';
import {replayCommunitySource} from './mission-replay';

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
