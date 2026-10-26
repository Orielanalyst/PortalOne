import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {configuredKobo} from '../src/lib/server/kobo';
import {configuredNightshift} from '../src/lib/server/runtime-config';
import {loadReportInferenceConsent,privateInferenceAllowed} from '../src/lib/server/report-inference-policy';

if(!process.argv.includes('--apply')) {
  console.log('Apply submits one explicitly synthetic report to the configured private Kobo project. It contains a fresh private exercise marker and fictional denied-road/unknown-clinic statements. The narrative/marker stay in ignored local files and are never printed. Requires scoped report-text authorization. Repeating apply reuses the same UUID.');process.exit(0);
}
const kobo=configuredKobo(),provider=configuredNightshift(),projectUid=kobo.sourceId.slice(5);
assert(privateInferenceAllowed(loadReportInferenceConsent(),projectUid,provider.baseUrl),'Enable scoped private report-text processing first.');
mkdirSync('.runtime/private-report',{recursive:true});const path='.runtime/private-report/demo.json';
const fixture=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):(()=>{
  const marker=`private-exercise-${randomUUID()}`;
  return {uuid:randomUUID(),projectUid,observedAt:new Date().toISOString(),marker,
    text:`DEMONSTRATION ONLY. At dusk in this fictional Bambili exercise, the road is not blocked and clinic capacity is unknown. Internal exercise note: ${marker}. No actual field observation is asserted.`};
})();
assert.equal(fixture.projectUid,projectUid,'Existing private test belongs to a different project.');
writeFileSync(path,JSON.stringify(fixture,null,2)+'\n');
let snapshot=await kobo.snapshot();
if(!snapshot.records.some(item=>(item.raw as Record<string,unknown>)['_uuid']===fixture.uuid)) {
  const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const xml=`<?xml version="1.0"?><${projectUid} id="${projectUid}"><report_mode>demo</report_mode><observed_at>${fixture.observedAt}</observed_at><place_name>Bambili</place_name><category>road_blockage</category><report_text>${escape(fixture.text)}</report_text><source_relation>reported</source_relation><meta><instanceID>uuid:${fixture.uuid}</instanceID></meta></${projectUid}>`;
  const body=new FormData();body.append('xml_submission_file',new Blob([xml],{type:'text/xml'}),'submission.xml');
  const response=await fetch(`${kobo.origin}/submission`,{method:'POST',body,redirect:'error',signal:AbortSignal.timeout(30_000),
    headers:{Authorization:`Token ${process.env['KOBO_API_TOKEN']}`,'X-OpenRosa-Version':'1.0'}});
  assert([201,202].includes(response.status),`Synthetic report submission failed: HTTP ${response.status}. Keep the persisted UUID.`);
  snapshot=await kobo.snapshot();
}
const record=snapshot.records.find(item=>(item.raw as Record<string,unknown>)['_uuid']===fixture.uuid);assert(record,'Private synthetic report was not returned by Kobo.');
writeFileSync('.runtime/private-report/intake.json',JSON.stringify({sourceId:snapshot.sourceId,signalId:record.signal.id,count:snapshot.count,receivedAt:snapshot.checkedAt},null,2)+'\n');
console.log(JSON.stringify({submittedOrReused:true,demonstrationOnly:true,reportReturnedByKobo:true,count:snapshot.count,narrativePrinted:false}));
