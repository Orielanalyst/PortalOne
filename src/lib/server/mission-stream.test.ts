// @vitest-environment node
import { MeterlessClient } from './meterless';
import { MissionJournal } from './mission-journal';
const frame=(value:unknown)=>`data: ${JSON.stringify(value)}\n\n`;
function client(text:string,finish='stop',done=true) {
  const body=frame({model:'test-provider',choices:[{delta:{reasoning_content:'private reasoning'}}]})+
    [...text].map(content=>frame({choices:[{delta:{content}}]})).join('')+
    frame({choices:[{delta:{},finish_reason:finish}],usage:{prompt_tokens:5,completion_tokens:8,total_tokens:13}})+(done?'data: [DONE]\n\n':'');
  const bytes=new TextEncoder().encode(body);
  return new MeterlessClient({baseUrl:'localhost:8088',token:'test',fetch:vi.fn(async()=>new Response(new ReadableStream({start(controller){
    for(let index=0;index<bytes.length;index+=7)controller.enqueue(bytes.slice(index,index+7));controller.close();
  }}),{headers:{'content-type':'text/event-stream'}})) as unknown as typeof fetch});
}
it('decodes split UTF-8 SSE tokens, ignores private reasoning and preserves the actual provider receipt',async()=>{
  const delta:string[]=[];
  const result=await client('## Evidence\n\nCafé reports are **unverified**.').stream('Public prompt','meterless/fast',{onDelta:text=>delta.push(text)});
  expect(delta.join('')).toBe('## Evidence\n\nCafé reports are **unverified**.');expect(delta.length).toBeGreaterThan(10);
  expect(result).toMatchObject({responseModel:'test-provider',requestedMode:'meterless/fast',usage:{total_tokens:13}});
  expect(result.content).not.toContain('private reasoning');expect(result.firstDeltaMs).not.toBeNull();
});
it.each(['length','missing_done','private_tag'])('rejects %s streams rather than publishing a successful answer',async fault=>{
  const seen:string[]=[];
  const stream=client(fault==='private_tag'?'<think>hidden content</think>answer':'Incomplete public text',fault==='length'?'length':'stop',fault!=='missing_done');
  await expect(stream.stream('Public prompt','meterless/fast',{onDelta:text=>seen.push(text)})).rejects.toThrow();
  expect(seen.join('')).not.toContain('hidden content');
});
it('publishes document deltas while the artifact is still streaming and freezes published drafts',()=>{
  const journal=new MissionJournal(':memory:');const changes:unknown[]=[];const unsubscribe=journal.subscribe(change=>changes.push(change));
  try {
    const id=journal.beginDocument({actor:'planner',kind:'plan',title:'Plan v1'});journal.appendDocument(id,'## Plan');journal.appendDocument(id,'\n\nCited draft');
    expect(journal.documents()[0]?.status).toBe('streaming');
    expect(changes).toContainEqual(expect.objectContaining({type:'delta',documentId:id,offset:7,delta:'\n\nCited draft'}));
    journal.finishDocument(id,'published');expect(()=>journal.appendDocument(id,'late text')).toThrow('no longer streaming');
    expect(journal.documents()[0]?.markdown).toBe('## Plan\n\nCited draft');
  }finally{unsubscribe();journal.close();}
});
