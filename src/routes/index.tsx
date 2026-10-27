import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, Check, ChevronRight, Circle, ClipboardList, FileSearch, FileText, Map as MapIcon, Shield, Square, Waves,PanelLeftClose,PanelLeftOpen } from 'lucide-react';
import type { MissionView } from '../lib/server/mission-runtime';
import {GeographyWorkspace} from '../components/geography-workspace';
import {CoordinatorReply} from '../components/coordinator-reply';
import {AreaMapActivity,AreaMapTrace} from '../components/area-map-tools';
import { MissionMarkdown } from '../components/mission-markdown';
import { DocumentView, PlanArtifacts, CommitteeReport, SourceRegister, ActiveWork, actorName } from '../components/mission-artifacts';
import '../mission.css';
import {MissionSessions} from '../components/mission-sessions';

export const Route = createFileRoute('/')({ component: Home });
type Tab = 'Activity' | 'Map' | 'Evidence' | 'Plan' | 'Report';
type Turn = MissionView['conversation'][number];
type Run = MissionView['runs'][number];
type Doc = MissionView['documents'][number];
const tabs: { name: Tab; Icon: typeof Activity }[] = [
  { name: 'Activity', Icon: Activity },
  { name: 'Map', Icon: MapIcon },
  { name: 'Evidence', Icon: FileSearch },
  { name: 'Plan', Icon: ClipboardList },
  { name: 'Report', Icon: FileText },
];
const example = 'Investigate community signals around Bambili. Map the reported places and tell me what we need before planning a delivery.';
const time = (at: string) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
function agentStatus(turn: Turn | null, run: Run | null, reply: Doc | undefined, summary: Doc | undefined) {
  if (reply?.status === 'streaming' && reply.markdown || summary?.status === 'streaming' && summary.markdown) return { label: 'Writing', state: 'writing' as const };
  if (turn?.status === 'pending') return { label: 'Preparing reply', state: 'thinking' as const };
  if (turn?.status === 'failed') return { label: 'Reply unavailable', state: 'error' as const };
  if (run?.status === 'running') return { label: 'Investigating', state: 'working' as const };
  if (run?.status === 'interrupted') return { label: 'Interrupted', state: 'error' as const };
  if (turn) return { label: 'Replied', state: 'done' as const };
  if (run) return { label: 'Complete', state: 'done' as const };
  return { label: 'Ready', state: 'done' as const };
}

function Home() {
  const [view, setView] = useState<MissionView | null>(null), [error, setError] = useState('');
  const [message, setMessage] = useState(''), [sending, setSending] = useState(false), [watch, setWatch] = useState(true);
  const [tab, setTab] = useState<Tab>('Activity'), [selected, setSelected] = useState<string | null>(null);
  const [atLatest, setAtLatest] = useState(true), [bootVisible, setBootVisible] = useState(false), [bootError, setBootError] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const conversationScroll=useRef<HTMLDivElement>(null),workspaceScroll=useRef<HTMLDivElement>(null);
  const followConversation=useRef(true),followWorkspace=useRef(true);
  const conversationFrame=useRef(0),workspaceFrame=useRef(0);
  const [liveFeed,setLiveFeed]=useState(false);
  const [sessionId,setSessionId]=useState<string|null>(()=>typeof window==='undefined'?null:new URL(window.location.href).searchParams.get('session'));
  const [startingMission,setStartingMission]=useState(false);
  const [workspaceExpanded,setWorkspaceExpanded]=useState(false);
  const observedGeography=useRef<{session:string;id:string|undefined}|null>(null);
  useEffect(()=>{if(!view)return;const id=view.areaMaps?.[0]?.id;if(observedGeography.current?.session===view.session.id&&id&&observedGeography.current.id!==id)setTab('Map');observedGeography.current={session:view.session.id,id};},[view?.areaMaps?.[0]?.id,view?.session.id]);
  useEffect(() => { if (view) { setBootVisible(false); setBootError(false); return; } const timer = window.setTimeout(() => setBootVisible(true), 250); const slow = window.setTimeout(() => setBootError(true), 10000); return () => { window.clearTimeout(timer); window.clearTimeout(slow); }; }, [view]);
  useEffect(() => {
    const query=new URLSearchParams();if(selected)query.set('run',selected);if(sessionId)query.set('session',sessionId);
    const feed=new EventSource(`/api/mission/stream${query.size?'?'+query.toString():''}`);
    feed.onopen=()=>setLiveFeed(true); feed.onerror=()=>setLiveFeed(false);
    feed.addEventListener('state',event=>{const next=JSON.parse((event as MessageEvent).data) as MissionView;setView(next);if(!sessionId&&next.session)setSessionId(next.session.id);setError('');});
    feed.addEventListener('delta',event=>{ const delta=JSON.parse((event as MessageEvent).data) as {documentId:string;offset:number;delta:string;updatedAt:string};
      setView(current=>current?{...current,documents:current.documents.map(document=>document.id===delta.documentId && document.markdown.length===delta.offset
        ? {...document,markdown:document.markdown+delta.delta,updatedAt:delta.updatedAt}:document)}:current);
    });
    return()=>feed.close();
  }, [selected,sessionId]);
  const streamedLength=view?.documents?.reduce((sum,document)=>sum+document.markdown.length,0) ?? 0;
  useLayoutEffect(()=>{if(!followConversation.current||!conversationScroll.current)return;window.cancelAnimationFrame(conversationFrame.current);conversationFrame.current=window.requestAnimationFrame(()=>{if(conversationScroll.current)conversationScroll.current.scrollTop=conversationScroll.current.scrollHeight;});},[streamedLength,view?.conversation.length,view?.activeRunId,view?.areaMaps?.[0]?.updatedAt]);
  useLayoutEffect(()=>{if(tab!=='Activity'||!followWorkspace.current||!workspaceScroll.current)return;window.cancelAnimationFrame(workspaceFrame.current);workspaceFrame.current=window.requestAnimationFrame(()=>{if(workspaceScroll.current)workspaceScroll.current.scrollTop=workspaceScroll.current.scrollHeight;});},[streamedLength,view?.events.length,tab]);
  useLayoutEffect(()=>{if(tab!=='Activity' && workspaceScroll.current)workspaceScroll.current.scrollTop=0;},[tab,selected]);
  async function send(text = message, directReplay = false) {
    if (sending || view?.chatBusy || view?.reviewBusy || startingMission || (view?.activeSessionId&&view.activeSessionId!==view.session?.id) || !text.trim()) return;
    setSending(true); setError('');
    try {
      const response = await fetch('/api/mission', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: directReplay ? 'investigate' : 'chat', message: text, watchMinutes: watch && view?.mode !== 'offline-replay' ? 30 : 0, sessionId:sessionId??view?.session?.id }) });
      if (!response.ok) throw new Error(); const receipt = await response.json();
      setMessage('');
      if (receipt.runId) { setSelected(null); setTab('Activity'); }
    } catch { setError('Unable to send your message. Check the connection and wait for any pending reply, then retry.'); }
    finally { setSending(false); }
  }
  function chooseMission(id:string) {
    setSessionId(id);setSelected(null);setView(null);setMessage('');setWatch(false);setError('');setTab('Activity');
    followConversation.current=true;followWorkspace.current=true;
    const url=new URL(window.location.href);url.searchParams.set('session',id);url.searchParams.delete('run');window.history.replaceState(window.history.state,'',url);
  }
  async function newMission() {
    if(startingMission)return;setStartingMission(true);setError('');
    try {
      const response=await fetch('/api/mission',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'new_session'})});
      if(!response.ok)throw new Error('Wait for active work to finish before starting a new mission.');
      const result=await response.json() as {session:{id:string}};
      const fresh=await fetch(`/api/mission?session=${encodeURIComponent(result.session.id)}`);
      chooseMission(result.session.id);if(fresh.ok)setView(await fresh.json());
    }catch(error){setError(error instanceof Error?error.message:'Unable to start a new mission. Please retry.');}
    finally{setStartingMission(false);}
  }
  async function stopMonitoring() {
    const response = await fetch('/api/mission', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"stop_monitor"}' });
    if (response.ok) { const query=new URLSearchParams();if(sessionId)query.set('session',sessionId);if(selected)query.set('run',selected);const current = await fetch('/api/mission?'+query.toString()); if (current.ok) setView(await current.json()); }
  }
  const busy = !!view?.activeRunId || sending || !!view?.mappingBusy, current = view?.selected;
  const chatBusy = sending || startingMission || !!view?.chatBusy || !!view?.reviewBusy || !!view?.mappingBusy || !!(view?.activeSessionId&&view.activeSessionId!==view.session?.id);
  const otherSessionBusy=!!(view?.activeSessionId&&view.activeSessionId!==view.session?.id);
  const busyLabel=otherSessionBusy?'Another mission is running':view?.mappingBusy?'Mapping the requested area':'Coordinator is replying';
  const headerTone = view?.mode === 'offline-replay' ? 'replay' : view?.federationStatus === 'unavailable' || view?.sourceStatus === 'unavailable' ? 'warning' : view?.federationStatus === 'online' || view?.sourceStatus === 'online' ? 'online' : 'idle';
  function openTab(name:Tab) {
    if((name==='Plan' || name==='Report') && !selected && view?.selected)setSelected(view.selected.id);
    setTab(name);
  }
  function jumpToLatest() {
    const element = conversationScroll.current; if (!element) return;
    followConversation.current = true; setAtLatest(true);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollTo({ top: element.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }
  const showBootSkeleton = !view && bootVisible;
  const booting = !view;
  const linkedRuns = new Set((view?.conversation ?? []).flatMap(turn => turn.runId ? [turn.runId] : []));
  const exchanges = [
    ...(view?.runs ?? []).filter(run => !linkedRuns.has(run.id)).map(run => ({ id: run.id, at: run.startedAt, run, turn: null })),
    ...(view?.conversation ?? []).map(turn => ({ id: turn.id, at: turn.createdAt, turn, run: view?.runs.find(run => run.id === turn.runId) ?? null })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return <div className={`mission-app${workspaceExpanded?' workspace-expanded':''}`}>
    <header className="mission-header"><div className="mission-brand"><span className="brand-mark"><Waves size={22} strokeWidth={1.6} /></span><div><strong>ReliefIntel</strong><span>Mission control</span></div></div>
      <div className="header-status" data-tone={headerTone} role="status"><span className={`status-dot ${view?.sourceStatus === 'online' ? 'online' : ''}`} />{view?.mode === 'offline-replay' ? 'Offline replay · no model calls' : view?.federationStatus === 'unavailable' ? 'Federation unavailable' : view?.federationStatus === 'online' ? 'Kobo + Zetaris connected' : view?.sourceStatus === 'online' ? 'Kobo connected' : view?.sourceStatus === 'unavailable' ? 'Source unavailable' : 'Ready to investigate'}
        {view?.monitorUntil && <><span className="monitor-label">Watching until {new Date(view.monitorUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><button className="icon-button" type="button" title="Stop watching for reports" aria-label="Stop watching for reports" onClick={() => void stopMonitoring()}><Square size={10} strokeWidth={2} /></button></>}
      </div><span className="header-label">Community intelligence · Cameroon</span>
    </header>
    <main className="mission-layout">
      <section className="conversation" aria-label="Mission conversation">
        <MissionSessions view={view} busy={busy||!!view?.chatBusy||!!view?.reviewBusy} starting={startingMission} onNew={()=>void newMission()} onSelect={chooseMission}/>
        <div className="conversation-title"><span><span className="status-dot online" />Mission Coordinator</span><small>One conversation. A shared picture.</small></div>
        <div ref={conversationScroll} onScroll={event=>{const element=event.currentTarget;const pinned=element.scrollHeight-element.scrollTop-element.clientHeight<70;followConversation.current=pinned;setAtLatest(pinned);}} className="conversation-scroll"><div className="coordinator-intro"><span className="eyebrow">LOCAL KNOWLEDGE, CONNECTED</span><h1>Understand the ground.<br />Then make the call.</h1><p>Tell me where you’re working. I’ll gather community signals, ground the places on a map, and show what we know — and what needs checking.</p></div>
          {view && !view.runs.length && (!view.conversation?.length || view.mode === 'offline-replay') && <button className="starter" onClick={() => void send(example, view.mode === 'offline-replay')} disabled={busy}><MapIcon size={17} strokeWidth={1.75} /><span>Investigate the Bambili area</span><ArrowRight size={16} strokeWidth={1.75} /></button>}
          {showBootSkeleton && <div className="turn-skeleton" aria-hidden="true"><div className="skeleton-turn"><span className="skeleton-line w-40" /><span className="skeleton-line" /><span className="skeleton-line w-80" /></div><div className="skeleton-turn"><span className="skeleton-line w-30" /><span className="skeleton-line" /><span className="skeleton-line w-60" /></div></div>}
          {exchanges.map(({ id, run, turn }, index) => { const conclusion = view?.conversationSummaries?.find(item => item.runId === run?.id); const replyDocument=view?.documents?.filter(item=>item.turnId===turn?.id && item.kind==='reply' && item.status!=='failed').at(-1); const summaryDocument=view?.documents?.filter(item=>item.runId===run?.id && item.kind==='summary' && item.status!=='failed').at(-1); const status=agentStatus(turn,run,replyDocument,summaryDocument); const isLast=index===exchanges.length-1; return <article className="conversation-turn" key={id}>
            <button type="button" className={`user-message ${run && selected === run.id ? 'selected-message' : ''}`} aria-current={run && selected === run.id ? 'true' : undefined} onClick={() => { if (run) setSelected(run.id); }}><span className="eyebrow">{turn ? 'YOUR MESSAGE' : run?.cause === 'operator' ? 'YOUR MISSION' : 'NEW SOURCE ACTIVITY'}</span>{turn?.message ?? run?.message}<time dateTime={turn?.createdAt ?? run!.startedAt}>{time(turn?.createdAt ?? run!.startedAt)}</time></button>
            <div className="agent-message"><div className="agent-line"><Waves size={15} strokeWidth={1.75} /><strong>Mission Coordinator</strong><span className="agent-status" data-state={status.state} aria-live={isLast && status.state !== 'done' ? 'polite' : undefined}><span className="status-orb" aria-hidden="true" />{status.label}</span></div>
              {turn && <CoordinatorReply turn={turn} document={replyDocument}/> }
              {run && <><MissionMarkdown text={summaryDocument?.markdown || conclusion?.reply || (run.status==='running' ? 'The specialists are working. Follow their live actions in Activity.' : run.result?.summary ?? 'Investigation interrupted; a fresh check is required.')} streaming={summaryDocument?.status==='streaming'} runId={run.id}/>
                <button type="button" className="trace-link" onClick={() => { setSelected(run.id); setTab('Activity'); }}><Activity size={14} strokeWidth={1.75} />View investigation trace<ChevronRight size={14} strokeWidth={1.75} /></button>
                {run.result && <div className="evidence-labels"><span>{run.result.demoReports} demonstration</span><span>{run.result.liveReports} live-labelled reports</span><span className="hold-label">{view?.assessmentStatuses?.[run.id] === 'invalidated' ? 'Superseded · fresh review required' : 'Planning on hold'}</span></div>}</>}
              {view?.areaMaps?.filter(job=>job.turnId===turn?.id).map(job=><AreaMapActivity key={job.id} job={job} onOpen={()=>setTab('Map')}/>)}{turn?.receipt && <details className="conversation-receipt"><summary>Reply model receipt</summary><p>{turn.receipt.responseModel ?? 'Unreported model'} · {turn.receipt.requestedMode} · {turn.receipt.durationMs} ms</p></details>}
              {conclusion?.receipt && <details className="conversation-receipt"><summary>Summary model receipt</summary><p>{conclusion.receipt.responseModel ?? 'Unreported model'} · {conclusion.receipt.requestedMode} · {conclusion.receipt.durationMs} ms</p></details>}
              {turn?.mode === 'offline-replay' && <small className="conversation-mode">Offline replay · no model call</small>}
            </div></article>; })}<div ref={end} />
        </div>
        <div className="composer-area">{!atLatest && !error && <button type="button" className="jump-latest" onClick={jumpToLatest}><ArrowDown size={14} strokeWidth={1.75} />Jump to latest</button>}{error && <p role="alert" className="mission-error">{error}</p>}<div className="composer" aria-busy={chatBusy}><textarea aria-label="Message the Mission Coordinator" placeholder="Describe your mission or ask about an area…" value={message} onChange={e => setMessage(e.target.value)} maxLength={2000}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
          <div className="composer-bottom"><label><input type="checkbox" checked={watch && view?.mode !== 'offline-replay'} disabled={view?.mode === 'offline-replay'} onChange={e => setWatch(e.target.checked)} />Watch new reports for 30 min</label><button type="button" aria-label={chatBusy ? busyLabel : 'Send message'} title={chatBusy ? busyLabel : 'Send message · Enter'} aria-busy={chatBusy} className="send-button" disabled={chatBusy || !message.trim()} onClick={() => void send()}>{chatBusy ? <span className="working-ring" /> : <ArrowUp size={18} strokeWidth={2} />}</button></div>
        </div><p className={`composer-note ${chatBusy ? 'is-busy' : ''}`} role="status">{chatBusy ? <><span className="working-ring" />{otherSessionBusy?'Another mission is running. Follow it in Mission history.':view?.mappingBusy?'Mapping the requested area — progress appears in Map.':view?.activeRunId?'Investigation running — latest steps appear in Activity.':'Coordinator is replying…'}</> : <><Shield size={12} strokeWidth={1.75} />Evidence informs decisions. An operator authorizes action.</>}</p></div>
      </section>
      <section className="workspace" aria-label="Investigation workspace">
        <div className="workspace-toolbar"><div role="tablist" aria-label="Investigation views">{tabs.map(({ name, Icon }) => <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => openTab(name)}><Icon size={16} strokeWidth={1.75} />{name}</button>)}</div><button type="button" className="workspace-focus-button" aria-label={workspaceExpanded?"Show conversation":"Expand workspace"} title={workspaceExpanded?"Show conversation":"Expand workspace"} aria-pressed={workspaceExpanded} onClick={()=>setWorkspaceExpanded(value=>!value)}>{workspaceExpanded?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}</button>{selected && selected !== view?.runs[0]?.id ? <button type="button" className="trace-link" onClick={() => setSelected(null)}>Back to latest</button> : <span className="workspace-live" data-tone={busy ? 'working' : liveFeed ? 'online' : 'offline'} role="status">{busy ? <><span className="working-ring" />{otherSessionBusy?'Another mission active':view?.mappingBusy?'Mapping area':chatBusy && !view?.activeRunId?'Coordinator replying':'Investigating'}</> : <><span className={`status-dot ${liveFeed?'online':''}`} />{liveFeed?'Live':'Reconnecting'}</>}</span>}</div>
        {tab==='Activity' && (view ? <ActiveWork view={view}/> : <div className="active-work active-work-skeleton" aria-hidden="true"><ol>{['01','02','03','04','05'].map(stage => <li key={stage}><span>{stage}</span><span className="skeleton-line w-60" /></li>)}</ol><div className="active-handoff"><div><span className="skeleton-line w-30" /><span className="skeleton-line w-70" /></div></div></div>)}<div ref={workspaceScroll} onScroll={event=>{const element=event.currentTarget;followWorkspace.current=element.scrollHeight-element.scrollTop-element.clientHeight<70;}} className={`workspace-content ${tab === 'Map' ? 'map-content' : ''}`} role="tabpanel" aria-label={tab}>
          {booting ? <div className="workspace-skeleton">{bootError && <p className="boot-error" role="status">Still connecting to the local mission feed. <button type="button" className="button secondary" onClick={() => window.location.reload()}>Retry</button></p>}<div aria-hidden="true"><span className="skeleton-line w-20" /><span className="skeleton-line skeleton-title" /><span className="skeleton-line w-60" /><div className="skeleton-rows">{['','','',''].map((_,index) => <div key={index}><span className="skeleton-line w-20" /><span className="skeleton-line" /><span className="skeleton-line w-70" /></div>)}</div></div></div> : <>
          {tab === 'Activity' && <><WorkspaceHeading eyebrow="A VISIBLE CHAIN OF WORK" title={current ? 'The investigation, step by step.' : 'Every action has a trace.'} detail="Delegations, source checks and evidence gaps appear here as they happen." />
            {view?.areaMaps?.[0] && <AreaMapTrace job={view.areaMaps[0]}/>}
            {!view?.events.length && !view?.areaMaps?.length ? <Empty icon={Activity} title="Your mission starts the investigation." detail="The coordinator brings in the specialists it needs." />
              : <ol className="action-timeline">{view.events.filter(e => e.kind !== 'model_receipt').map(event => <li key={event.seq} className={event.kind === 'hold' || event.kind === 'source_unavailable' ? 'event-hold' : ''}>
                <span className="timeline-icon">{event.kind === 'task_started' ? <Circle size={13} strokeWidth={1.75} /> : event.kind === 'evidence_gap' || event.kind === 'assessment_invalidated' ? <AlertTriangle size={13} strokeWidth={1.75} /> : event.kind === 'hold' ? <Shield size={13} strokeWidth={1.75} /> : <Check size={13} strokeWidth={1.75} />}</span><div className="event-body"><div className="event-meta"><strong>{actorName(event.actor)}</strong><time>{time(event.at)}</time></div><p>{event.detail}</p>{event.kind==='model_started' && view.documents.filter(document=>event.evidenceIds.includes(document.id)).map(document=><DocumentView key={document.id} document={document}/>)}
                  {event.evidenceIds.length > 0 && <button type="button" className="trace-link" onClick={() => setTab(event.kind === 'query' || event.kind === 'assessment_invalidated' ? 'Plan' : 'Evidence')}>{event.evidenceIds.length} linked reference{event.evidenceIds.length === 1 ? '' : 's'}<ArrowUpRight size={12} strokeWidth={1.75} /></button>}
                  {event.taskId && <details><summary>Task reference</summary><code>{event.taskId}</code>{event.parentTaskId && <small>Delegated by {event.parentTaskId}</small>}</details>}
                </div></li>)}</ol>}
            {!!view?.events.some(e => e.kind === 'model_receipt') && <details className="model-receipts"><summary>Model routing receipts</summary>{view.events.filter(e => e.kind === 'model_receipt').map(e => { const receipt = JSON.parse(e.detail); return <p key={e.seq}>{receipt.responseModel ?? 'Unreported model'} · {receipt.requestedMode} · {receipt.durationMs} ms</p>; })}</details>}
          </>}
          {tab === 'Map' && view && <GeographyWorkspace view={view} />}{tab==='Report' && view && <><WorkspaceHeading eyebrow="COMMITTEE REVIEW PACK" title="The committee report." detail="A cited narrative, native map and editable GIS evidence layers."/><CommitteeReport view={view} onSelectRun={setSelected}/></>}
          {tab === 'Evidence' && <><WorkspaceHeading eyebrow="WHAT REACHED THE SYSTEM" title="Community evidence." detail="Reports remain unverified claims. Repeated submissions and forwards do not establish independent corroboration." />
            {view && view.citations.length>0 && <SourceRegister view={view}/>}<div className="evidence-source"><span>{view?.mode === 'offline-replay' ? 'Offline fixture' : 'KoboToolbox'} · {view?.sourceStatus ?? 'unchecked'}</span>{view?.checkedAt && <time>Checked {time(view.checkedAt)}</time>}{view?.projectUrl && <a href={view.projectUrl} target="_blank" rel="noreferrer">Open private project<ArrowUpRight size={13} strokeWidth={1.75} /></a>}</div>
            {view?.signals.length ? <div className="evidence-list">{view.signals.map(signal => <article key={signal.id}><div className="report-title"><h3>{signal.placeName}</h3><span className={signal.mode === 'demo' ? 'demo-badge' : 'live-badge'}>{signal.mode === 'demo' ? 'DEMONSTRATION' : 'LIVE · UNVERIFIED'}</span></div><p>{signal.category.replaceAll('_', ' ')} · {signal.relation === 'direct' ? 'Claimed direct observation' : signal.relation}</p><dl><div><dt>Observed</dt><dd>{new Date(signal.observedAt).toLocaleString()}</dd></div><div><dt>Received</dt><dd>{new Date(signal.receivedAt).toLocaleString()}</dd></div><div><dt>Origin</dt><dd>Unverified</dd></div><div><dt>Location</dt><dd>{view.groundings.find(g => g.signalId === signal.id)?.gap ?? 'Not grounded yet'}</dd></div></dl><code>{signal.id}</code></article>)}</div>
              : <Empty icon={FileSearch} title="No reports retrieved yet." detail="An empty feed does not mean an area is clear." />}
          </>}
          {tab === 'Plan' && <><WorkspaceHeading eyebrow="READY FOR THE NEXT DECISION" title="The mission plan." detail="Published drafts, evaluator critique and the exact changes between versions." />{view && <PlanArtifacts view={view} onSelectRun={setSelected}/>} {current?.result ? <div className="brief-body"><span className="hold-status"><Shield size={15} strokeWidth={1.75} />Operational planning on hold</span><h3>{current.result.summary}</h3>{view && <FederatedPlanning view={view} />}<h4>Evidence needed</h4><ul>{current.result.gaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul><div className="brief-footnote">Mapped roads and facilities provide context. They do not establish current passability, service availability or permission to travel.</div></div>
            : <Empty icon={FileText} title="The brief follows the investigation." detail="Findings link back to source reports and checks." />}</>}
          </>}
        </div>
      </section>
    </main>
  </div>;
}
function WorkspaceHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) { return <div className="workspace-heading"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{detail}</p></div>; }
function Empty({ icon: Icon, title, detail }: { icon: typeof Activity; title: string; detail: string }) { return <div className="empty-workspace"><span className="empty-icon"><Icon size={22} strokeWidth={1.5} /></span><p>{title}</p><span>{detail}</span></div>; }
function FederatedPlanning({ view }: { view: MissionView }) {
  const assessment = view.assessments?.at(-1); if (!assessment) return null;
  const context = assessment.evidence;
  return <section className="federated-planning" aria-label="Federated planning evidence">
    <div className="planning-source"><strong>{context.mode === 'live-zetaris' ? 'Federated through Zetaris' : 'Offline fixture calculation'}</strong><span>{assessment.status === 'invalidated' ? 'Superseded · fresh review required' : assessment.status === 'checked' ? 'Evidence basis independently checked' : 'Awaiting independent check'}</span></div>
    <p>{assessment.advice.rationale}</p><small>{context.reportCount} reports · {context.demoCount} demonstration · {context.liveCount} live-labelled · {context.forwardedCount ?? 0} forwarded. Ambiguous place candidates share reports. Stock and fleet refer to a linked rehearsal depot, not assets observed at the report location.</small>
    <div className="planning-table-wrap"><table><thead><tr><th>Community</th><th>Reports</th><th>Registered stock</th><th>Registered fleet</th></tr></thead><tbody>{context.rows.map(row => <tr key={row.placeId}><td>{row.name}{row.ambiguous > 0 && <small>Alternative place candidate</small>}</td><td>{row.reports}<small>Unverified</small></td><td>{row.stockUnits === null ? 'Unknown' : `${row.stockUnits} rehearsal kits`}<small>{row.stockUnits === null ? 'No linked ledger' : row.stockFresh ? 'Synthetic data' : 'Synthetic · expired'}</small></td><td>{row.fleetCount === null ? 'Unknown' : `${row.fleetCount} registered`}<small>{row.fleetCount === null ? 'No linked fleet' : row.fleetFresh ? 'Synthetic data' : 'Synthetic · expired'}</small></td></tr>)}</tbody></table></div>
    <details><summary>Source revision and query receipts</summary><code>{assessment.id}</code><code>Application {view.applicationSourceCommit ?? 'revision unavailable'}</code><code>Evidence {context.revision}</code><p>Fetched {new Date(context.fetchedAt).toLocaleString()}</p>{[...context.queries.map(q => ({ ...q, actor: 'Planning' })), ...(assessment.checks ?? []).flatMap(c => c.evidence.queries.map(q => ({ ...q, actor: 'Independent check' })))].map(q => <div key={q.id}><strong>{q.actor} · {q.name}</strong><p>{q.rowCount} bounded rows · {q.durationMs} ms</p><code>{q.id}</code><pre>{q.sql}</pre></div>)}</details>
  </section>;
}
