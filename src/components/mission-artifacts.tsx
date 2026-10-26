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
  return <div className="plan-artifacts"><MissionCurrency view={view} onSelectRun={onSelectRun}/><MissionInputs view={view}/><div className="artifact-switcher">{documents.map(item=><button key={item.id} onClick={()=>setSelection({runId,id:item.id})} aria-pressed={document?.id===item.id}>{item.kind==='plan'?`Plan v${item.version}`:item.kind==='critique'?`Review v${item.version}`:item.metadata['fromRunId']?'Mission update diff':`Diff → v${item.version}`}{item.status==='failed'?' · rejected':''}</button>)}</div>
    {document?<DocumentView document={document}/>:<p className="artifact-empty">The Planning Agent will publish the initial draft here before evaluation.</p>}
    <OperatorReviewControls view={view} selectedDocumentId={document?.id} onChoosePlan={id=>setSelection({runId,id})} onSelectRun={onSelectRun}/><MissionMemory view={view}/>
  </div>;
}
function OperatorReviewControls({view,selectedDocumentId,onChoosePlan,onSelectRun}:{view:MissionView;selectedDocumentId?:string;onChoosePlan:(id:string)=>void;onSelectRun?:(id:string)=>void}) {
  const candidate=view.reviewCandidate,[comment,setComment]=useState(''),[acknowledged,setAcknowledged]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('');
  useEffect(()=>{setAcknowledged(false);setComment('');setError('');},[candidate?.planId,candidate?.evidenceRevision,candidate?.requirementsRevision,candidate?.calculationId]);
  if(!candidate)return null;
  const exact=selectedDocumentId===candidate.planId;
  const submit=async(decision:'approve'|'reject'|'request_changes')=>{
    setPending(true);setError('');
    try {
      const response=await fetch('/api/mission',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'review',requestId:crypto.randomUUID(),
        runId:candidate.runId,planId:candidate.planId,version:candidate.version,planSha256:candidate.planSha256,evidenceRevision:candidate.evidenceRevision,
        requirementsRevision:candidate.requirementsRevision,calculationId:candidate.calculationId,decision,comment,acknowledgedHolds:acknowledged})});
      const result=await response.json();if(!response.ok)throw new Error(result.error ?? 'The decision could not be recorded.');
      if(result.replacementRunId)onSelectRun?.(result.replacementRunId);
    }catch(error){setError(error instanceof Error?error.message:'The decision could not be recorded.');}finally{setPending(false);}
  };
  return <section className="operator-review"><strong>Committee decision · plan v{candidate.version}</strong>
    {!exact?<p><button onClick={()=>onChoosePlan(candidate.planId)}>Open the exact plan to review</button></p>:<>
      <p>Your decision applies to this proposal’s exact inputs, evidence and calculation. Approval retains the field and endpoint holds.</p>
      {!candidate.canApprove && <details><summary>Inputs or checks still required</summary><ul>{candidate.reasons.map((reason,index)=><li key={index}>{reason}</li>)}</ul></details>}
      <label className="review-ack"><input type="checkbox" checked={acknowledged} onChange={event=>setAcknowledged(event.target.checked)} disabled={pending || view.reviewBusy}/><span>I have reviewed the inputs and unresolved gaps. I am approving a committee proposal; travel remains subject to field confirmation.</span></label>
      <label className="review-comment">Reason or requested changes<textarea value={comment} onChange={event=>setComment(event.target.value)} maxLength={600} rows={3} disabled={pending}/></label>
      <div className="review-actions"><button onClick={()=>void submit('approve')} disabled={pending || view.reviewBusy || !candidate.canApprove || !acknowledged}>Approve proposal</button>
        <button onClick={()=>void submit('request_changes')} disabled={pending || view.reviewBusy || !candidate.canReview || !comment.trim()}>Request changes</button>
        <button onClick={()=>void submit('reject')} disabled={pending || view.reviewBusy || !candidate.canReview || !comment.trim()}>Reject proposal</button></div>
      {pending && <p role="status">Checking this proposal and recording your decision…</p>}{error && <p role="alert">{error}</p>}
    </>}
    {view.reviews.length>0 && <ol className="review-history">{[...view.reviews].reverse().map(review=><li key={review.id}><strong>{review.decision.replaceAll('_',' ')} · {review.status}</strong><p>Plan v{review.version} · {new Date(review.createdAt).toLocaleString()}</p>{review.reason && <p>{review.reason}</p>}{review.comment && <p>{review.comment}</p>}
      <a href={`/api/mission?run=${encodeURIComponent(review.runId)}&reviewReceipt=${encodeURIComponent(review.id)}`}>Download version-bound decision receipt</a>{review.replacementRunId && onSelectRun && <button onClick={()=>onSelectRun(review.replacementRunId!)}>Open revised mission</button>}</li>)}</ol>}
  </section>;
}
function MissionInputs({view}:{view:MissionView}) {
  const pending=view.requirements && view.requirements.revision!==view.selectedRequirements?.revision;
  const profile=pending?view.requirements:view.selectedRequirements,planning=pending?null:view.planning;
  if(!profile)return null;
  return <section className="mission-inputs"><strong>{pending?'Current conversation inputs · fresh proposal required':'This proposal’s mission inputs'} · version {profile.version}</strong><p>{profile.missing.length ? `${profile.missing.length} inputs still need confirmation. Supply them in the conversation; known values are retained.`:'Inputs are recorded from your messages. Resource statements remain operator-reported.'}</p><p>Time phrases use Cameroon time (UTC+01:00), unless you supply an explicit offset.</p>
    <details><summary>Inspect inputs and gaps</summary><dl>{Object.entries(profile.values).map(([key,value])=><div key={key}><dt>{key.replace(/([A-Z])/g,' $1')}</dt><dd>{String(value)}</dd></div>)}</dl>{profile.missing.length>0 && <ul>{profile.missing.map(item=><li key={item.field}>{item.label}</li>)}</ul>}</details>
    {planning && <div><strong>Deterministic feasibility · {planning.status.replaceAll('_',' ')}</strong>{planning.calculations && <p>{planning.calculations.cargoKg} kg cargo · {planning.calculations.distanceKm} km mapped candidate · {planning.calculations.requiredFuelLitres.toFixed(2)} L fuel requirement · arrival {planning.calculations.arrivalAt}</p>}
      <ul>{planning.checks.map(check=><li key={check.code}><strong>{check.status}</strong> · {check.message}</li>)}</ul><p>Proposal review and travel authorization are separate. Field and endpoint gaps retain the operational hold.</p></div>}
  </section>;
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
    <a href={`/api/mission/evidence?run=${encodeURIComponent(citation.runId)}&id=${citation.id}${citation.kind==='interpretation'?'&support=1':''}`} target="_blank" rel="noreferrer">{citation.kind==='interpretation'?citation.supportVisibility==='private'?'Inspect private quotes · local only ↗':'Inspect supporting quotes and model receipt ↗':'Inspect source record and hash ↗'}</a>{citation.sourceUrl && <a href={citation.sourceUrl} target="_blank" rel="noreferrer">Original source ↗</a>}</article>)}</div>;
}
