import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import examples from '../data/kobo/interpretation-examples-v1.json';
import {NightshiftSignalInterpreter,validateQuotedClaims,textHash,InterpretationCheckError} from '../src/lib/server/signal-interpretation';
import {configuredNightshift} from '../src/lib/server/runtime-config';

if(!process.argv.includes('--apply')) {
  console.log('Apply makes two native Nemotron calls using only the checked-in English/French synthetic examples. No Kobo narrative is sent. It verifies negation, unknown service status, exact quotes and native receipts. Existing receipts are never overwritten.');
  process.exit(0);
}
const directory='.runtime/report-interpretation';mkdirSync(directory,{recursive:true});
const tag=process.argv.find(arg=>arg.startsWith('--tag='))?.slice(6) ?? '';
assert(!tag || /^[a-z0-9-]{1,32}$/.test(tag),'Use a short safe rehearsal tag.');
const target=`${directory}/public-examples${tag?'-'+tag:''}.json`;
assert(!existsSync(target),'Preserve the existing rehearsal receipt.');
const interpreter=new NightshiftSignalInterpreter(configuredNightshift());
const results=[];
try {
  for(const id of ['negation-example','french-example']) {
    const example=examples.find(item=>item.id===id)!;let progress=0;
    const answer=await interpreter.extract(example,AbortSignal.timeout(60_000),()=>progress++);
    results.push({exampleId:id,textSha256:textHash(example.text),value:answer.value,receipt:answer.receipt});
    validateQuotedClaims(answer.value,example.text);
    assert(progress>1,'Expected an actual incremental provider stream.');
    assert(answer.value.claims.some(claim=>claim.category==='road_blockage' && claim.assertion==='denied'),'The fictional denial must survive extraction.');
    assert(answer.value.claims.some(claim=>claim.category==='service_status' && claim.assertion==='uncertain'),'Unknown operating status/capacity must remain uncertain.');
    assert(answer.value.claims.every(claim=>claim.assertion!=='reported'),'Synthetic content cannot become an actual reported observation.');
    assert.deepEqual([answer.receipt.upstream?.fromCache,answer.receipt.upstream?.qualityBuffered,answer.receipt.upstream?.reasoningScaffold,answer.receipt.upstream?.phaseCount],[false,false,false,1]);
    console.log(JSON.stringify({exampleId:id,checked:true,claims:answer.value.claims.map(claim=>({category:claim.category,assertion:claim.assertion})),deltas:answer.receipt.deltas}));
  }
  writeFileSync(target,JSON.stringify({checkedAt:new Date().toISOString(),sourceCommit:Bun.spawnSync(['git','rev-parse','HEAD']).stdout.toString().trim(),
    input:'Exact checked-in public synthetic examples only; no private narrative transmitted.',results,passed:true},null,2)+'\n');
}catch(error) {
  writeFileSync(`${directory}/failed-${Date.now()}.json`,JSON.stringify({at:new Date().toISOString(),results,error:error instanceof Error?error.message:'Failed',
    ...(error instanceof InterpretationCheckError?{rejectedAttempt:error.attempt}:{})},null,2)+'\n');
  throw error;
}
