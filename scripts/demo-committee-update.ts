import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {strict as assert} from 'node:assert';
import {createParser} from 'eventsource-parser';
import {configuredKobo} from '../src/lib/server/kobo';
import type {MissionView} from '../src/lib/server/mission-runtime';

const tag=process.argv.find(argument=>argument.startsWith('--tag='))?.slice('--tag='.length) ?? '';
if(tag && !/^[a-z0-9-]{1,32}$/.test(tag))throw new Error('Invalid rehearsal tag.');
const origin='http://127.0.0.1:8080',folder=`.runtime/committee-update${tag?'/'+tag:''}`;
if(!process.argv.includes('--apply')) {
  console.log(JSON.stringify({operation:'Run two watched committee reviews, submit one idempotent labelled demonstration, verify World Model invalidation, historical downloads and a fresh native PDF/GIS pack.',
    writes:'One clearly labelled demonstration in the configured Kobo project; local run/artifact receipts. No field incident or dispatch asserted.',
    requirements:['Idle local live app','Kobo project containing demonstrations only','Zetaris, Nightshift/Nemotron, cached QGIS and report Python'],
    limits:'Two ten-minute workflow budgets plus the bounded source watch. A failed live step remains a failed live step.'},null,2));process.exit(0);
}
mkdirSync(folder,{recursive:true});
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
async function state(runId?:string):Promise<MissionView> {
  const response=await fetch(`${origin}/api/mission${runId?`?run=${encodeURIComponent(runId)}`:''}`,{signal:AbortSignal.timeout(15_000)});
  assert.equal(response.status,200,'Local mission API unavailable');return response.json() as Promise<MissionView>;
}
async function waitFor(predicate:(view:MissionView)=>boolean,runId?:string,timeout=680_000) {
  const until=Date.now()+timeout;
  while(Date.now()<until) {const view=await state(runId);if(predicate(view))return view;await Bun.sleep(1000);}
  throw new Error('Bounded committee rehearsal exceeded its wait.');
}
async function download(runId:string,name:string,historical=false) {
  const response=await fetch(`${origin}/api/mission/download?run=${encodeURIComponent(runId)}&file=${encodeURIComponent(name)}${historical?'&historical=1':''}`,{signal:AbortSignal.timeout(30_000)});
  return {response,bytes:new Uint8Array(await response.arrayBuffer())};
}
const initial=await state();assert.equal(initial.mode,'live');assert.equal(initial.activeRunId,null);assert.equal(initial.monitorUntil,null);
const commit=Bun.spawnSync(['git','rev-parse','HEAD'],{stdout:'pipe'}).stdout.toString().trim();
assert.equal(initial.applicationSourceCommit,commit,'Restart the app after committing before binding live proof.');
assert.equal(Bun.spawnSync(['git','status','--porcelain','--','src','scripts','package.json','data'],{stdout:'pipe'}).stdout.toString().trim(),'','Commit source changes before capture.');
const source=await configuredKobo().snapshot();assert(source.records.every(record=>record.signal.mode==='demo'),'Use a demonstration-only project.');
const demoPath=`.runtime/kobo/transport-test-mission-update${tag?'-'+tag:''}.json`;
if(existsSync(demoPath)) {
  const saved=JSON.parse(readFileSync(demoPath,'utf8'));
  assert(!source.records.some(record=>(record.raw as Record<string,unknown>)['_uuid']===saved.uuid),'This demonstration already exists; preserve its original proof.');
}
const streamAbort=new AbortController(),streams:Record<string,{deltas:number;beforePublication:number;v1BeforeEvaluation:boolean}>={};
let streamedView:MissionView|undefined,firstId:string|undefined;
const eventStream=await fetch(`${origin}/api/mission/stream`,{signal:streamAbort.signal});assert(eventStream.body);
const parser=createParser({onEvent(event){
  if(event.event==='state') {
    streamedView=JSON.parse(event.data) as MissionView;
    const runId=streamedView.selected?.id;if(!runId)return;
    const entry=streams[runId] ??= {deltas:0,beforePublication:0,v1BeforeEvaluation:false};
    if(streamedView.documents.some(document=>document.runId===runId && document.kind==='plan' && document.version===1 && document.status==='published') &&
      !streamedView.events.some(item=>item.actor==='evaluator' && item.kind==='task_started'))entry.v1BeforeEvaluation=true;
  }else if(event.event==='delta') {
    const delta=JSON.parse(event.data),document=streamedView?.documents.find(item=>item.id===delta.documentId);
    if(document?.runId) {const entry=streams[document.runId] ??= {deltas:0,beforePublication:0,v1BeforeEvaluation:false};entry.deltas++;if(document.status==='streaming')entry.beforePublication++;}
  }
}});
const pump=(async()=>{const reader=eventStream.body!.getReader(),decoder=new TextDecoder();try{while(true){const chunk=await reader.read();if(chunk.done)break;parser.feed(decoder.decode(chunk.value,{stream:true}));}}catch(error){if(!streamAbort.signal.aborted)throw error;}})();
function verifiedRun(view:MissionView) {
  assert.equal(view.reportBundle?.status,'ready',view.selected?.result?.summary);
  assert.equal(view.currency?.status,'snapshot');assert(view.memory?.plans.length);assert(view.memory.audit.length);
  const documents=view.documents.filter(document=>document.runId===view.selected?.id);
  for(const document of documents.filter(document=>document.status==='published' && ['findings','plan','critique','report'].includes(document.kind))) {
    const receipt=document.metadata['receipt'] as {upstream?:{fromCache:boolean;qualityBuffered:boolean;reasoningScaffold:boolean;phaseCount:number}};
    assert(receipt.upstream);assert.deepEqual([receipt.upstream.fromCache,receipt.upstream.qualityBuffered,receipt.upstream.reasoningScaffold,receipt.upstream.phaseCount],[false,false,false,1]);
  }
  assert.equal(view.selected?.result?.liveReports,0);assert(view.assessments.every(assessment=>assessment.evidence.rows.every(row=>row.verifiedOrigins===0)));
  return {run:view.selected,documents,citations:view.citations,events:view.events,assessments:view.assessments,memory:view.memory,currency:view.currency,bundle:view.reportBundle};
}
try {
  const request='Demonstration: map hospitals and health facilities in the Bamenda-Bambili corridor, assess the access evidence, and prepare a downloadable committee proposal and GIS pack. Include evaluator review and revisions. Keep demonstration data, missing capacity and road conditions explicit.';
  const response=await fetch(`${origin}/api/mission`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'chat',message:request,watchMinutes:30}),signal:AbortSignal.timeout(60_000)});
  assert.equal(response.status,200);const turn=await response.json() as {runId?:string};assert(turn.runId,'Coordinator did not delegate the explicit mission.');firstId=turn.runId;
  writeFileSync(`${folder}/pointer.json`,JSON.stringify({phase:'baseline_running',firstId,commit},null,2));console.log(JSON.stringify({phase:'baseline_running',runId:firstId,commit}));
  const before=await waitFor(view=>view.selected?.status==='complete' && view.activeRunId===null,firstId);const baseline=verifiedRun(before);
  const original=await download(firstId,'report.pdf');assert.equal(original.response.status,200);const originalHash=hash(original.bytes);
  const firstManifest=JSON.parse(new TextDecoder().decode((await download(firstId,'manifest.json')).bytes));assert.equal(firstManifest.publicationCheck.revision,before.reportBundle!.revision);
  writeFileSync(`${folder}/baseline.json`,JSON.stringify(baseline,null,2));
  writeFileSync(`${folder}/pointer.json`,JSON.stringify({phase:'baseline_ready',firstId,commit},null,2));console.log(JSON.stringify({phase:'baseline_ready',runId:firstId,reports:source.count}));
  if(process.argv.includes('--browser-proof')) {
    const until=Date.now()+90_000;while(!existsSync(`${folder}/browser-ready.json`) && Date.now()<until)await Bun.sleep(500);
    assert(existsSync(`${folder}/browser-ready.json`),'Browser did not pin the baseline report within its bounded wait.');
  }
  const submit=Bun.spawn(['bun','scripts/check-kobo.ts','--submit-demo','--demo-case=mission-update',...(tag?[`--demo-tag=${tag}`]:[])],{stdout:'pipe',stderr:'pipe'});
  assert.equal(await submit.exited,0,'Labelled Kobo demonstration failed; inspect local intake diagnostics.');
  console.log(JSON.stringify({phase:'demonstration_submitted',note:'Waiting for the application watch; no second mission is manually launched.'}));
  const after=await waitFor(view=>view.selected?.id!==firstId && view.currency?.previousRunId===firstId && view.selected?.status==='complete' && view.activeRunId===null);
  await fetch(`${origin}/api/mission`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{"action":"stop_monitor"}'});
  const replacement=verifiedRun(after),history=await state(firstId),nextId=after.selected!.id;
  assert.equal(history.currency?.status,'superseded');assert.equal(history.currency.replacementRunId,nextId);
  assert(history.memory?.plans.every(plan=>plan.status==='invalidated'));assert(after.documents.some(document=>document.metadata['fromRunId']===firstId && document.kind==='diff'));
  assert.equal(after.assessments.at(-1)!.evidence.reportCount,source.count+1);assert.equal(after.assessments.at(-1)!.evidence.forwardedCount,before.assessments.at(-1)!.evidence.forwardedCount+1);
  assert.equal((await download(firstId,'report.pdf')).response.status,409);
  const old=await download(firstId,'report.pdf',true);assert.equal(old.response.status,200);assert.equal(old.response.headers.get('X-ReliefIntel-Evidence-Status'),'superseded');assert.equal(hash(old.bytes),originalHash);
  const pdf=await download(nextId,'report.pdf'),zip=await download(nextId,'committee-pack.zip');assert.equal(pdf.response.status,200);assert.equal(zip.response.status,200);
  for(const [name,file] of [['report.pdf',pdf],['committee-pack.zip',zip]] as const)assert.equal(hash(file.bytes),after.reportBundle!.files.find(item=>item.name===name)!.sha256);
  const manifest=JSON.parse(new TextDecoder().decode((await download(nextId,'manifest.json')).bytes));assert.equal(manifest.previousRunId,firstId);assert.equal(manifest.publicationCheck.revision,after.reportBundle!.revision);
  assert.equal(manifest.qgis.layers.find((layer:{layer:string})=>layer.layer==='blockages').count,firstManifest.qgis.layers.find((layer:{layer:string})=>layer.layer==='blockages').count+1);
  for(const id of [firstId,nextId]) {assert(streams[id]!.beforePublication>50);assert(streams[id]!.v1BeforeEvaluation);}
  const files=['src/lib/server/mission-world.ts','src/lib/server/mission-journal.ts','src/lib/server/mission-runtime.ts','src/lib/server/committee-mission.ts','src/lib/server/committee-export.ts','src/lib/server/mission-dossier.ts','src/components/mission-artifacts.tsx','src/routes/api.mission.download.ts','src/routes/index.tsx','scripts/render-committee-pdf.py','scripts/check-kobo.ts','scripts/demo-committee-update.ts'];
  const receipt={capturedAt:new Date().toISOString(),applicationSourceCommit:commit,request,
    note:'Actual Kobo, Zetaris, Nightshift/Nemotron and native QGIS/PDF over labelled demonstrations. The new point uses a public map reference selected for the rehearsal, not a field incident. Zero verified field origins; no dispatch authorized.',
    baseline,replacement,historical:{runId:firstId,currency:history.currency,memory:history.memory,pdfSha256:originalHash},
    streaming:{baseline:streams[firstId],replacement:streams[nextId]},publicationCheck:manifest.publicationCheck,
    checks:{automaticReplacement:true,worldModelInvalidation:true,v1BeforeEvaluation:true,crossMissionDiff:true,staleDirectDownloadRejected:true,historicalBytesPreserved:true,
      pdfAndZipHashesMatch:true,locatedDemonstrationPointExported:true,forwardNotVerifiedOrigin:true,watchStopped:true,dispatchAuthorized:false},
    sourceFiles:files.map(file=>({file,sha256:hash(readFileSync(file))}))};
  writeFileSync(`${folder}/receipt.json`,JSON.stringify(receipt,null,2)+'\n');
  writeFileSync(`${folder}/pointer.json`,JSON.stringify({phase:'verified',firstId,nextId,commit},null,2));console.log(JSON.stringify({phase:'verified',firstId,nextId,checks:receipt.checks,streaming:receipt.streaming}));
}catch(error) {
  writeFileSync(`${folder}/error.json`,JSON.stringify({at:new Date().toISOString(),firstId,message:error instanceof Error?error.message:'Rehearsal failed'},null,2));throw error;
}finally {
  const latest=await state().catch(()=>null);
  if(firstId && latest?.monitorUntil && (latest.selected?.id===firstId || latest.currency?.previousRunId===firstId))await fetch(`${origin}/api/mission`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{"action":"stop_monitor"}'});
  streamAbort.abort();await pump;
}
