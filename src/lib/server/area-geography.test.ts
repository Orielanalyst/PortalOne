// @vitest-environment node
import {areaBounds,featureBounds,findAreaPlaces,overlaps} from '../area-geography';
import type {AreaMap,AreaPlace} from '../area-geography';
import {AreaGeography} from './area-geography';
import {MissionRuntime} from './mission-runtime';
import {MissionJournal} from './mission-journal';
import {replayCommunitySource,replayDispatcher} from './mission-replay';
import {ConversationDecision} from './mission-conversation';
const place:AreaPlace={id:'places-node:1',name:'Limbé',kind:'city',lat:4,lng:9};
const duplicate={...place,id:'places-node:2',lng:13};
class GeographyFixture extends AreaGeography{
  fail=false;
  override ready(){return true;}
  override async prepare(){}
  override search(query:string){return query==='Missing'?[]:query==='Ambiguous'?[place,duplicate]:[place];}
  override async build(value:AreaPlace,progress:(detail:string)=>void){progress('Mapped actual fixture features.');if(this.fail)throw new Error('Source verification failed.');return {key:'a'.repeat(64),place:value,bounds:areaBounds(value),counts:{roads:2,facilities:0,places:1},files:{},halfWidthKm:5,createdAt:new Date().toISOString(),sourceAcquiredAt:'2026-10-25T00:00:00Z',attribution:'Fixture',sourceUrls:[],limits:'No verified conditions.'} as AreaMap;}
}
function runtime(geography=new GeographyFixture()){
  const journal=new MissionJournal(':memory:');
  return {journal,geography,runtime:new MissionRuntime({journal,geography,source:replayCommunitySource,dispatcher:replayDispatcher,
    conversation:{respond:async()=>({action:'map_area',area:'Limbé',mission:null,reply:'I will map the requested area.'})}})};
}
it('retains ambiguous source matches and normalizes accents without inventing a place',()=>{
  expect(findAreaPlaces([place,duplicate],'Limbe, Cameroon')).toHaveLength(2);
  expect(findAreaPlaces([place],'Unknown')).toEqual([]);
  expect(findAreaPlaces([place],'<script>')).toEqual([]);
});
it('builds a bounded viewing extent from source coordinates and retains intersecting source geometry',()=>{
  const box=areaBounds(place);expect(box[0]).toBeLessThan(place.lng);expect(box[2]).toBeGreaterThan(place.lng);
  expect(()=>areaBounds({...place,lat:NaN})).toThrow();
  const line=featureBounds({type:'Feature',geometry:{type:'LineString',coordinates:[[8,4],[10,4]]},properties:{}})!;
  expect(overlaps(line,box)).toBe(true);expect(overlaps([15,5,16,6],box)).toBe(false);
});
it('requires source selection for ambiguous area names and never builds the first match silently',async()=>{
  const f=runtime();try{const session=f.runtime.state().session;const job=f.runtime.mapArea(session.id,'Ambiguous');
    await vi.waitFor(()=>expect(f.journal.areaMap(job.id)?.status).toBe('choose_place'));
    expect(f.journal.areaMap(job.id)).toMatchObject({map:null,candidates:[place,duplicate]});
  }finally{f.runtime.stopMonitor();f.journal.close();}
});
it('persists source-backed map results in their own conversation and preserves zero facilities',async()=>{
  const f=runtime();try{const first=f.runtime.state().session,job=f.runtime.mapArea(first.id,'Limbé');
    expect(()=>f.runtime.newSession()).toThrow(/active work/);
    await vi.waitFor(()=>expect(f.journal.areaMap(job.id)?.status).toBe('ready'));
    const second=f.runtime.newSession();expect(f.runtime.state(undefined,second.id).areaMaps).toEqual([]);
    expect(f.runtime.state(undefined,first.id).areaMaps[0]?.map?.counts.facilities).toBe(0);
    expect(f.journal.areaMap(job.id)?.steps.map(step=>step.actor)).toContain('Mapping Agent');
  }finally{f.runtime.stopMonitor();f.journal.close();}
});
it('marks missing or failed source maps explicitly without a ready artifact',async()=>{
  const f=runtime();try{const session=f.runtime.state().session,missing=f.runtime.mapArea(session.id,'Missing');
    await vi.waitFor(()=>expect(f.journal.areaMap(missing.id)?.status).toBe('failed'));
    f.geography.fail=true;const failed=f.runtime.mapArea(session.id,'Limbé');
    await vi.waitFor(()=>expect(f.journal.areaMap(failed.id)?.status).toBe('failed'));
    expect(f.journal.areaMap(failed.id)).toMatchObject({map:null,error:'Source verification failed.'});
  }finally{f.runtime.stopMonitor();f.journal.close();}
});
it('delegates an actual mapping action from conversation without starting the committee workflow',async()=>{
  expect(ConversationDecision.parse({action:'map_area',reply:'Mapping the area.',area:'Limbé',mission:null}).action).toBe('map_area');
  const f=runtime();try{const session=f.runtime.state().session,turn=await f.runtime.chat('Map Limbé health facilities.',0,session.id);
    await vi.waitFor(()=>expect(f.runtime.state(undefined,session.id).areaMaps[0]?.status).toBe('ready'));
    expect(turn).toMatchObject({action:'map_area',runId:null});expect(f.journal.recent()).toEqual([]);
    expect(f.runtime.state(undefined,session.id).areaMaps[0]?.turnId).toBe(turn.id);
  }finally{f.runtime.stopMonitor();f.journal.close();}
});
