import { useEffect, useState } from 'react';
import type { MissionView } from '../lib/server/mission-runtime';
import type { MissionDocument } from '../lib/mission-artifacts';
import { MissionMarkdown } from './mission-markdown';
export const actorName=(actor:string)=>({coordinator:'Mission Coordinator',expert:'Mission Expert',planner:'Planning Agent',evaluator:'Evaluator Agent',reporter:'Report preparation',recon:'Mission Expert · reports',mapping:'Mission Expert · mapping',logistics:'Planning / logistics',checker:'Independent checker',intake:'Report intake',memory:'Mission memory · Meterless World Model'} as Record<string,string>)[actor] ?? actor;
export function ActiveWork({view}:{view:MissionView}) {
  const documents=view.documents.filter(document=>document.runId===view.selected?.id);
  const active=[...documents].reverse().find(document=>document.status==='streaming');
  const latest=view.events.filter(event=>event.kind!=='model_receipt').at(-1);
  const stages=[['findings','Investigate'],['plan','Plan v1'],['critique','Evaluate'],['diff','Revise'],['report','Report']];
  return <div className="active-work"><ol>{stages.map(([kind,label],index)=><li key={kind} data-complete={documents.some(document=>document.kind===kind && document.status==='published')} data-active={active?.kind===kind}><span>{String(index+1).padStart(2,'0')}</span>{label}</li>)}</ol>
    <div className="active-handoff">{view.activeRunId===view.selected?.id ? <><span className="working-ring"/><div><strong>{actorName(active?.actor ?? latest?.actor ?? 'coordinator')}</strong><p>{active?.title ?? latest?.detail ?? 'Preparing the next handoff.'}</p></div></> : <div><strong>{view.currency?.status==='superseded'?'Superseded · fresh review required':view.reportBundle?.status==='ready'?'Committee draft ready':view.selected?.result?'Mission review on hold':'Ready to investigate'}</strong><p>{view.currency?.status==='superseded'?'Evidence changed. This run and its downloads are historical snapshots.':view.reportBundle?.status==='ready'?'Open Report for the PDF and GIS pack. Field confirmations remain open.':view.selected?.result?.summary ?? 'Describe the area and question in the conversation.'}</p></div>}</div>
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
function MissionCurrency({view,onSelectRun}:{view:MissionView;onSelectRun?:(id:string)=>void}) {
  const currency=view.currency;
  if(currency?.status==='superseded')return <aside className="mission-currency" role="status"><strong>Superseded mission snapshot</strong><p>{currency.reason ?? 'Evidence changed after this plan was prepared.'} Earlier documents remain available for comparison.</p>
    {currency.replacementRunId && onSelectRun && <button onClick={()=>onSelectRun(currency.replacementRunId!)}>Open replacement mission</button>}</aside>;
  if(currency?.previousRunId)return <aside className="mission-lineage"><strong>Replacement mission</strong><p>A fresh evidence review follows the earlier snapshot. Field confirmations remain open.</p>{onSelectRun && <button onClick={()=>onSelectRun(currency.previousRunId!)}>Compare previous mission</button>}</aside>;
  return null;
}
export function MissionMemory({view}:{view:MissionView}) {
  const memory=view.memory;
  if(!memory?.plans.length)return null;
  return <details className="mission-memory"><summary>Mission memory · Meterless World Model</summary><p>Published plans depend on exact evidence snapshots. Changed evidence withdraws that snapshot’s eligibility for review; it never grants dispatch approval.</p>
    {memory.plans.map(plan=><article key={plan.id}><strong>Plan v{plan.version} · {plan.status==='invalidated'?'superseded':'evidence dependency recorded'}</strong><code>{plan.revision}</code>{plan.changes.length>0 && <ul>{plan.changes.filter(change=>change.label!=='Report/map input revision').map((change,index)=><li key={index}>{change.label}: {String(change.before ?? 'unknown')} → {String(change.after ?? 'unknown')}</li>)}</ul>}</article>)}
    <small>{memory.events.length} engine events · namespace {memory.namespace}</small><ol>{memory.events.map(event=><li key={event.id}><code>{event.id}</code> {event.kind} · {new Date(event.at).toLocaleTimeString()}</li>)}</ol></details>;
}
export function PlanArtifacts({view,onSelectRun}:{view:MissionView;onSelectRun?:(id:string)=>void}) {
  const documents=view.documents.filter(document=>document.runId===view.selected?.id && ['plan','critique','diff'].includes(document.kind));
  const runId=view.selected?.id ?? null;
  const [selection,setSelection]=useState<{runId:string|null;id:string}|null>(null);
  const document=documents.find(document=>selection?.runId===runId && document.id===selection.id) ?? documents.filter(document=>document.kind==='plan').at(-1);
  useEffect(()=>{if(document && (selection?.runId!==runId || selection.id!==document.id))setSelection({runId,id:document.id});},[document?.id,runId,selection]);
  return <div className="plan-artifacts"><MissionCurrency view={view} onSelectRun={onSelectRun}/><div className="artifact-switcher">{documents.map(item=><button key={item.id} onClick={()=>setSelection({runId,id:item.id})} aria-pressed={document?.id===item.id}>{item.kind==='plan'?`Plan v${item.version}`:item.kind==='critique'?`Review v${item.version}`:item.metadata['fromRunId']?'Mission update diff':`Diff → v${item.version}`}{item.status==='failed'?' · rejected':''}</button>)}</div>
    {document?<DocumentView document={document}/>:<p className="artifact-empty">The Planning Agent will publish the initial draft here before evaluation.</p>}<MissionMemory view={view}/>
  </div>;
}
export function CommitteeReport({view,onSelectRun}:{view:MissionView;onSelectRun?:(id:string)=>void}) {
  const document=view.documents.filter(document=>document.runId===view.selected?.id && document.kind==='report').at(-1),bundle=view.reportBundle;
  const stale=view.currency?.status==='superseded';
  const download=(name:string)=>`/api/mission/download?run=${encodeURIComponent(view.selected?.id ?? '')}&file=${encodeURIComponent(name)}${stale?'&historical=1':''}`;
  const reportName=bundle?.files.filter(file=>/^report(?:-edition-\d+)?\.pdf$/.test(file.name)).at(-1)?.name ?? 'report.pdf';
  const packName=bundle?.files.filter(file=>/^committee-pack(?:-edition-\d+)?\.zip$/.test(file.name)).at(-1)?.name ?? 'committee-pack.zip';
  return <div className="committee-report"><MissionCurrency view={view} onSelectRun={onSelectRun}/>{bundle?.status==='ready'?<div className="download-pack"><strong>{stale?'Historical draft and geodata.':'Committee draft and geodata are ready.'}</strong><p>{stale?'These files preserve the original snapshot. Evidence has since changed; use the replacement for fresh review.':bundle.note}</p><div><a href={download(reportName)}>{stale?'Download historical PDF':'Download committee PDF'}</a><a href={download(packName)}>{stale?'Download historical GIS pack':'Download complete GIS pack'}</a></div><small><a href={download('mission.gpkg')}>GeoPackage{stale?' · historical':''}</a> · <a href={download('map.pdf')}>Full-resolution map PDF{stale?' · historical':''}</a> · Native QGIS project, GeoJSON, styles, sources and draft history are included in the ZIP.</small></div>
    :bundle?<div className="export-status"><span className={bundle.status==='building'?'working-ring':''}/>{bundle.note}</div>:<p className="artifact-empty">The report will follow the published plan and evaluator review. Export stages will appear in Activity.</p>}{document && <DocumentView document={document}/>}</div>;
}
export function SourceRegister({view}:{view:MissionView}) {
  return <div className="source-register">{view.citations.map(citation=><article key={citation.id} id={citation.id}><div><span>{citation.kind}</span><code>{citation.id}</code></div><h3>{citation.title}</h3>{citation.kind==='query'?<details><summary>Open bounded source/query facts</summary><p>{citation.statement}</p></details>:<p>{citation.statement}</p>}
    <a href={`/api/mission/evidence?run=${encodeURIComponent(citation.runId)}&id=${citation.id}`} target="_blank" rel="noreferrer">Inspect source record and hash ↗</a>{citation.sourceUrl && <a href={citation.sourceUrl} target="_blank" rel="noreferrer">Original source ↗</a>}</article>)}</div>;
}
