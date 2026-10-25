import { useEffect, useState } from 'react';
import type { MissionView } from '../lib/server/mission-runtime';
import type { MissionDocument } from '../lib/mission-artifacts';
import { MissionMarkdown } from './mission-markdown';
export const actorName=(actor:string)=>({coordinator:'Mission Coordinator',expert:'Mission Expert',planner:'Planning Agent',evaluator:'Evaluator Agent',reporter:'Report preparation',recon:'Mission Expert · reports',mapping:'Mission Expert · mapping',logistics:'Planning / logistics',checker:'Independent checker',intake:'Report intake'} as Record<string,string>)[actor] ?? actor;
export function ActiveWork({view}:{view:MissionView}) {
  const documents=view.documents.filter(document=>document.runId===view.selected?.id);
  const active=[...documents].reverse().find(document=>document.status==='streaming');
  const latest=view.events.filter(event=>event.kind!=='model_receipt').at(-1);
  const stages=[['findings','Investigate'],['plan','Plan v1'],['critique','Evaluate'],['diff','Revise'],['report','Report']];
  return <div className="active-work"><ol>{stages.map(([kind,label],index)=><li key={kind} data-complete={documents.some(document=>document.kind===kind && document.status==='published')} data-active={active?.kind===kind}><span>{String(index+1).padStart(2,'0')}</span>{label}</li>)}</ol>
    {view.activeRunId===view.selected?.id && <div className="active-handoff"><span className="working-ring"/><div><strong>{actorName(active?.actor ?? latest?.actor ?? 'coordinator')}</strong><p>{active?.title ?? latest?.detail ?? 'Preparing the next handoff.'}</p></div></div>}
  </div>;
}
export function DocumentView({document}:{document:MissionDocument}) {
  const receipt=document.metadata['receipt'] as {responseModel?:string;requestedMode?:string;deltas?:number;firstDeltaMs?:number} | undefined;
  return <section className={`document-view document-${document.status}`} data-document-id={document.id}>
    <div className="document-heading"><strong>{document.title}</strong><span>{document.status==='streaming'?'Generating live':document.status==='published'?'Published':'Incomplete · step failed'}</span></div>
    {document.markdown ? <MissionMarkdown text={document.markdown} streaming={document.status==='streaming'} runId={document.runId}/> : <p className="stream-wait"><span className="working-ring"/>Waiting for the model’s first text…</p>}
    {receipt && <details className="conversation-receipt"><summary>Model and streaming receipt</summary><p>{receipt.responseModel ?? 'Model unreported'} · {receipt.requestedMode}{receipt.deltas ? ` · ${receipt.deltas} provider deltas` : ''}{receipt.firstDeltaMs ? ` · first text ${receipt.firstDeltaMs} ms` : ''}</p></details>}
  </section>;
}
export function PlanArtifacts({view}:{view:MissionView}) {
  const documents=view.documents.filter(document=>document.runId===view.selected?.id && ['plan','critique','diff'].includes(document.kind));
  const runId=view.selected?.id ?? null;
  const [selection,setSelection]=useState<{runId:string|null;id:string}|null>(null);
  const document=documents.find(document=>selection?.runId===runId && document.id===selection.id) ?? documents.filter(document=>document.kind==='plan').at(-1);
  useEffect(()=>{if(document && (selection?.runId!==runId || selection.id!==document.id))setSelection({runId,id:document.id});},[document?.id,runId,selection]);
  return <div className="plan-artifacts"><div className="artifact-switcher">{documents.map(item=><button key={item.id} onClick={()=>setSelection({runId,id:item.id})} aria-pressed={document?.id===item.id}>{item.kind==='plan'?`Plan v${item.version}`:item.kind==='critique'?`Review v${item.version}`:`Diff → v${item.version}`}{item.status==='failed'?' · rejected':''}</button>)}</div>
    {document?<DocumentView document={document}/>:<p className="artifact-empty">The Planning Agent will publish the initial draft here before evaluation.</p>}
  </div>;
}
export function CommitteeReport({view}:{view:MissionView}) {
  const document=view.documents.filter(document=>document.runId===view.selected?.id && document.kind==='report').at(-1),bundle=view.reportBundle;
  const download=(name:string)=>`/api/mission/download?run=${encodeURIComponent(view.selected?.id ?? '')}&file=${encodeURIComponent(name)}`;
  return <div className="committee-report">{bundle?.status==='ready'?<div className="download-pack"><strong>Committee draft and geodata are ready.</strong><p>{bundle.note}</p><div><a href={download('report.pdf')}>Download committee PDF</a><a href={download('committee-pack.zip')}>Download complete GIS pack</a></div><small><a href={download('mission.gpkg')}>GeoPackage</a> · <a href={download('map.pdf')}>Full-resolution map PDF</a> · Native QGIS project, GeoJSON, styles, sources and draft history are included in the ZIP.</small></div>
    :bundle?<div className="export-status"><span className={bundle.status==='building'?'working-ring':''}/>{bundle.note}</div>:<p className="artifact-empty">The report will follow the published plan and evaluator review. Export stages will appear in Activity.</p>}{document && <DocumentView document={document}/>}</div>;
}
export function SourceRegister({view}:{view:MissionView}) {
  return <div className="source-register">{view.citations.map(citation=><article key={citation.id} id={citation.id}><div><span>{citation.kind}</span><code>{citation.id}</code></div><h3>{citation.title}</h3>{citation.kind==='query'?<details><summary>Open bounded source/query facts</summary><p>{citation.statement}</p></details>:<p>{citation.statement}</p>}
    <a href={`/api/mission/evidence?run=${encodeURIComponent(citation.runId)}&id=${citation.id}`} target="_blank" rel="noreferrer">Inspect source record and hash ↗</a>{citation.sourceUrl && <a href={citation.sourceUrl} target="_blank" rel="noreferrer">Original source ↗</a>}</article>)}</div>;
}
