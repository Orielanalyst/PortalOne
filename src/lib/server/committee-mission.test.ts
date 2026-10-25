// @vitest-environment node
import { MissionJournal } from './mission-journal';
import { CommunityMap } from './community-map';
import { replayCommunitySource } from './mission-replay';
import { FixtureCommunityEvidence } from './community-evidence';
import { buildDossier,validateCitedMarkdown } from './mission-dossier';
import { runCommitteeMission } from './committee-mission';
import type { CommitteeWriter } from './committee-mission';
const map=new CommunityMap();
it('exposes an unsupported area as a coverage gap before any source, model or export action',async()=>{
  const journal=new MissionJournal(':memory:');
  try {
    const run=journal.startRun('Map hospitals\nArea: Douala','test');const readSource=vi.fn(),stream=vi.fn(),exporter=vi.fn();
    const result=await runCommitteeMission({run,journal,map,readSource,writer:{stream},evidence:new FixtureCommunityEvidence(map),exporter});
    expect(result.gaps[0]).toContain('Requested area: Douala');expect(readSource).not.toHaveBeenCalled();expect(stream).not.toHaveBeenCalled();expect(exporter).not.toHaveBeenCalled();
  }finally{journal.close();}
});
it('keeps unknown facility capacity, unlocated blockages and unsurveyed zones explicit',async()=>{
  const source=await replayCommunitySource.snapshot();const evidence=await new FixtureCommunityEvidence(map).load(source,AbortSignal.timeout(1000));
  const dossier=buildDossier('test','Map health facilities',source,evidence,map);
  expect(dossier.layers['facilities']?.features).toHaveLength(7);expect(dossier.layers['blockages']?.features).toHaveLength(0);expect(dossier.layers['intervention_zones']?.features).toHaveLength(0);
  expect(dossier.layers['facilities']?.features.every(feature=>feature.geometry.type==='Point' && feature.properties?.['capacity']===null)).toBe(true);
  expect(dossier.citations.filter(citation=>citation.kind==='facility').every(citation=>citation.sourceUrl?.startsWith('https://www.openstreetmap.org/'))).toBe(true);
  expect(dossier.modelEvidence.filter(citation=>['facility','community'].includes(citation.kind)).every(citation=>!/\b\d{1,3}\.\d{4,}\b/.test(citation.statement))).toBe(true);
  expect(dossier.gaps.join(' ')).toContain('not an exhaustive');
});
it('rejects uncited paragraphs, unknown citations and placeholder content',async()=>{
  const source=await replayCommunitySource.snapshot(),evidence=await new FixtureCommunityEvidence(map).load(source,AbortSignal.timeout(1000));
  const dossier=buildDossier('test','Map facilities',source,evidence,map),id=dossier.citations[0]!.id;
  const content=`## Findings\n\n${'A sourced draft statement with explicit limits. '.repeat(5)}[${id}]`;
  expect(validateCitedMarkdown(content,dossier.citations)).toEqual([id]);
  expect(validateCitedMarkdown(content+'\n\n## Questions\n\n- What current field confirmation is available?\n- Who will confirm facility capacity?',dossier.citations)).toEqual([id]);
  expect(validateCitedMarkdown('**Verdict: REVISE**\n\n'+content,dossier.citations)).toEqual([id]);
  for(const bad of [content+'\n\nAn unsupported claim.',content.replace(id,'E0000000000'),content+'\n\nTBD',content+`\n\n## Another section\nAn uncited claim.`,content+`\n\nA location at 10.1974985. [${id}]`]) expect(()=>validateCitedMarkdown(bad,dossier.citations)).toThrow();
});
it('publishes v1 before evaluation, revises with an actual diff and reports only after independent review',async()=>{
  const journal=new MissionJournal(':memory:'),source=await replayCommunitySource.snapshot();let reviews=0;
  const writer:CommitteeWriter={async stream(prompt,mode,options){
    const id=prompt.match(/"id":"(E[a-f0-9]{10})"/)![1];
    const repeated=`The committee should verify current field and resource evidence before any operational decision. [${id}]`;
    const review=prompt.includes('Start with ## Evaluation');
    const content=review?`## Evaluation\n\n**Verdict: ${++reviews===1?'REVISE':'ACCEPT_WITH_GAPS'}** [${id}]\n\n${repeated}\n\n${repeated}`
      :`## Objective\n\n${repeated}\n\n## Actions\n\n${repeated}\n\n## Risks\n\n${repeated}${prompt.includes('Revise the complete plan')?`\n\n## What changed and why\n\nA field verification lead now owns the confirmation gate. [${id}]`:''}`;
    options.onDelta(content.slice(0,45));await Promise.resolve();options.onDelta(content.slice(45));
    return {content,requestedMode:mode,responseModel:'explicit-test-fixture',usage:undefined,durationMs:1,firstDeltaMs:0,deltas:2};
  }};
  try {
    const run=journal.startRun('Investigate Bambili and prepare a committee draft.','test');const reads=vi.fn(async()=>source);let exported=false;
    const result=await runCommitteeMission({run,journal,map,writer,readSource:reads,evidence:new FixtureCommunityEvidence(map),exporter:async()=>{exported=true;}});
    expect(result.disposition).toBe('hold');expect(exported).toBe(true);expect(reads).toHaveBeenCalledTimes(3);
    const documents=journal.documents(run.id);expect(documents.filter(document=>document.kind==='plan').map(document=>document.version)).toEqual([1,2]);
    expect(documents.find(document=>document.kind==='diff')?.markdown).toContain('+## What changed and why');
    const events=journal.events(run.id);const firstPlan=documents.find(document=>document.kind==='plan')!;
    const published=events.find(event=>event.kind==='artifact_published' && event.evidenceIds.includes(firstPlan.id))!;
    const evaluation=events.find(event=>event.kind==='task_started' && event.actor==='evaluator')!;
    expect(published.seq).toBeLessThan(evaluation.seq);expect(events.filter(event=>event.kind==='handoff').every(event=>event.detail.includes('→') || event.detail.includes('Mission Expert'))).toBe(true);
  }finally{journal.close();}
});
it('preserves a rejected draft and permits one visible source-check repair before independent review',async()=>{
  const journal=new MissionJournal(':memory:'),source=await replayCommunitySource.snapshot();let calls=0;
  const writer:CommitteeWriter={async stream(prompt,mode,options){
    const id=prompt.match(/"id":"(E[a-f0-9]{10})"/)![1];
    const paragraph=`The committee must confirm current field evidence before any operational decision. [${id}]`;
    let content=`## Draft\n\n${paragraph}\n\n${paragraph}\n\n${paragraph}`;
    if(++calls===1)content+='\n\nThis unsupported factual block must prevent publication.';
    if(prompt.includes('Start with ## Evaluation'))content=`## Evaluation\n\n**Verdict: ACCEPT_WITH_GAPS** [${id}]\n\n${content}`;
    options.onDelta(content);
    return {content,requestedMode:mode,responseModel:'explicit-test-fixture',usage:undefined,durationMs:1,firstDeltaMs:0,deltas:1};
  }};
  try {
    const run=journal.startRun('Prepare a cited Bambili committee draft.','test');const exported=vi.fn(async()=>{});
    await runCommitteeMission({run,journal,map,writer,readSource:async()=>source,evidence:new FixtureCommunityEvidence(map),exporter:exported});
    expect(exported).toHaveBeenCalledTimes(1);
    expect(journal.documents(run.id).filter(document=>document.kind==='findings').map(document=>document.status)).toEqual(['failed','published']);
    expect(journal.documents(run.id)[0]?.metadata['receipt']).toMatchObject({responseModel:'explicit-test-fixture'});
    expect(journal.events(run.id).filter(event=>event.kind==='publication_repair')).toHaveLength(1);
    expect(journal.events(run.id).some(event=>event.kind==='independent_check')).toBe(true);
  }finally{journal.close();}
});
