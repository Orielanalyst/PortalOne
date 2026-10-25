import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, ArrowUp, ArrowUpRight, Check, ChevronRight, Circle, FileText, Map as MapIcon, Radio, Shield, Square, Waves } from 'lucide-react';
import type { MissionView } from '../lib/server/mission-runtime';
import { CommunityMapView } from '../components/community-map';
import '../mission.css';

export const Route = createFileRoute('/')({ component: Home });
type Tab = 'Activity' | 'Map' | 'Evidence' | 'Brief';
const example = 'Investigate community signals around Bambili. Map the reported places and tell me what we need before planning a delivery.';
const time = (at: string) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function Home() {
  const [view, setView] = useState<MissionView | null>(null), [error, setError] = useState('');
  const [message, setMessage] = useState(''), [sending, setSending] = useState(false), [watch, setWatch] = useState(true);
  const [tab, setTab] = useState<Tab>('Activity'), [selected, setSelected] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try { const response = await fetch(`/api/mission${selected ? `?run=${encodeURIComponent(selected)}` : ''}`);
        if (!response.ok) throw new Error(); const data = await response.json();
        if (!cancelled) { setView(data); setError(''); }
      } catch { if (!cancelled) setError('The mission service is unavailable. Check the local server and source configuration.'); }
    };
    void refresh(); const timer = setInterval(() => void refresh(), 1500);
    return () => { cancelled = true; clearInterval(timer); };
  }, [selected]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [view?.runs.length, view?.activeRunId, view?.conversation?.length, view?.chatBusy]);
  async function send(text = message, directReplay = false) {
    if (sending || view?.chatBusy || !text.trim()) return;
    setSending(true); setError('');
    try {
      const response = await fetch('/api/mission', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: directReplay ? 'investigate' : 'chat', message: text, watchMinutes: watch && view?.mode !== 'offline-replay' ? 30 : 0 }) });
      if (!response.ok) throw new Error(); const receipt = await response.json();
      setMessage('');
      if (receipt.runId) { setSelected(null); setTab('Activity'); }
    } catch { setError('Unable to send your message. Check the connection and wait for any pending reply, then retry.'); }
    finally { setSending(false); }
  }
  async function stopMonitoring() {
    const response = await fetch('/api/mission', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"stop_monitor"}' });
    if (response.ok) { const current = await fetch('/api/mission'); if (current.ok) setView(await current.json()); }
  }
  const busy = !!view?.activeRunId || sending, current = view?.selected;
  const chatBusy = sending || !!view?.chatBusy;
  const linkedRuns = new Set((view?.conversation ?? []).flatMap(turn => turn.runId ? [turn.runId] : []));
  const exchanges = [
    ...(view?.runs ?? []).filter(run => !linkedRuns.has(run.id)).map(run => ({ id: run.id, at: run.startedAt, run, turn: null })),
    ...(view?.conversation ?? []).map(turn => ({ id: turn.id, at: turn.createdAt, turn, run: view?.runs.find(run => run.id === turn.runId) ?? null })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return <div className="mission-app">
    <header className="mission-header"><div className="mission-brand"><span className="brand-mark"><Waves size={21} /></span><div><strong>ReliefIntel</strong><span>Mission control</span></div></div>
      <div className="header-status"><span className={`status-dot ${view?.sourceStatus === 'online' ? 'online' : ''}`} />{view?.mode === 'offline-replay' ? 'OFFLINE REPLAY · no model calls' : view?.federationStatus === 'unavailable' ? 'Federation unavailable' : view?.federationStatus === 'online' ? 'Kobo + Zetaris connected' : view?.sourceStatus === 'online' ? 'Kobo connected' : view?.sourceStatus === 'unavailable' ? 'Source unavailable' : 'Ready to investigate'}
        {view?.monitorUntil && <><span className="monitor-label">Watching until {new Date(view.monitorUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><button className="icon-button" title="Stop watching for reports" onClick={() => void stopMonitoring()}><Square size={12} /></button></>}
      </div><span className="header-label">Bamenda · Bambili</span>
    </header>
    <main className="mission-layout">
      <section className="conversation" aria-label="Mission conversation">
        <div className="conversation-title"><span><span className="status-dot online" /> Mission Coordinator</span><small>One conversation. A shared picture.</small></div>
        <div className="conversation-scroll"><div className="coordinator-intro"><span className="eyebrow">LOCAL KNOWLEDGE, CONNECTED</span><h1>Understand the ground.<br />Then make the call.</h1><p>Tell me where you’re working. I’ll gather community signals, ground the places on a map, and show what we know — and what needs checking.</p></div>
          {!view?.runs.length && (!view?.conversation?.length || view?.mode === 'offline-replay') && <button className="starter" onClick={() => void send(example, view?.mode === 'offline-replay')} disabled={busy}><MapIcon size={17} /><span>Investigate the Bambili area</span><ArrowUpRight size={16} /></button>}
          {exchanges.map(({ id, run, turn }) => { const conclusion = view?.conversationSummaries?.find(item => item.runId === run?.id); return <article className="conversation-turn" key={id}>
            <button className={`user-message ${run && selected === run.id ? 'selected-message' : ''}`} onClick={() => { if (run) setSelected(run.id); }}><span className="eyebrow">{turn ? 'YOUR MESSAGE' : run?.cause === 'operator' ? 'YOUR MISSION' : 'NEW SOURCE ACTIVITY'}</span>{turn?.message ?? run?.message}<time>{time(turn?.createdAt ?? run!.startedAt)}</time></button>
            <div className="agent-message"><div className="agent-line"><Waves size={15} /><strong>Mission Coordinator</strong><small>{turn?.status === 'pending' ? 'Replying' : turn?.status === 'failed' ? 'Reply unavailable' : run?.status === 'running' ? 'Investigating' : run?.status === 'interrupted' ? 'Interrupted' : turn ? 'Replied' : 'Complete'}</small></div>
              {turn && <p>{turn.reply ?? 'Reading your message…'}</p>}
              {run && <><p>{conclusion?.reply ?? (conclusion?.status === 'pending' ? 'Bringing the findings together…' : run.result?.summary ?? (run.status === 'running' ? 'Delegating the investigation. Follow each step in the activity trace.' : 'This run was interrupted. Start a fresh investigation to check current evidence.'))}</p>
                <button className="trace-link" onClick={() => { setSelected(run.id); setTab('Activity'); }}><Activity size={14} />View investigation trace<ChevronRight size={14} /></button>
                {run.result && <div className="evidence-labels"><span>{run.result.demoReports} demonstration</span><span>{run.result.liveReports} live-labelled reports</span><span className="hold-label">{view?.assessmentStatuses?.[run.id] === 'invalidated' ? 'Superseded · fresh review required' : 'Planning on hold'}</span></div>}</>}
              {turn?.receipt && <details className="conversation-receipt"><summary>Reply model receipt</summary><p>{turn.receipt.responseModel ?? 'Unreported model'} · {turn.receipt.requestedMode} · {turn.receipt.durationMs} ms</p></details>}
              {conclusion?.receipt && <details className="conversation-receipt"><summary>Summary model receipt</summary><p>{conclusion.receipt.responseModel ?? 'Unreported model'} · {conclusion.receipt.requestedMode} · {conclusion.receipt.durationMs} ms</p></details>}
              {turn?.mode === 'offline-replay' && <small className="conversation-mode">Offline replay · no model call</small>}
            </div></article>; })}<div ref={end} />
        </div>
        <div className="composer-area">{error && <p role="alert" className="mission-error">{error}</p>}<div className="composer"><textarea aria-label="Message the Mission Coordinator" placeholder="Describe your mission or ask about an area…" value={message} onChange={e => setMessage(e.target.value)} maxLength={2000}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
          <div className="composer-bottom"><label><input type="checkbox" checked={watch && view?.mode !== 'offline-replay'} disabled={view?.mode === 'offline-replay'} onChange={e => setWatch(e.target.checked)} />Watch new reports for 30 min</label><button aria-label="Send message" className="send-button" disabled={chatBusy || !message.trim()} onClick={() => void send()}>{chatBusy ? <span className="working-ring" /> : <ArrowUp size={18} />}</button></div>
        </div><p className="composer-note"><Shield size={11} />Evidence informs decisions. An operator authorizes action.</p></div>
      </section>
      <section className="workspace" aria-label="Investigation workspace">
        <div className="workspace-toolbar"><div role="tablist" aria-label="Investigation views">{(['Activity', 'Map', 'Evidence', 'Brief'] as Tab[]).map((name, i) => { const Icon = [Activity, MapIcon, Radio, FileText][i]!; return <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)}><Icon size={15} />{name}</button>; })}</div>{selected && selected !== view?.runs[0]?.id ? <button className="trace-link" onClick={() => setSelected(null)}>Back to latest</button> : <span className="workspace-live">{busy ? <><span className="working-ring" />Investigating</> : 'Evidence workspace'}</span>}</div>
        <div className={`workspace-content ${tab === 'Map' ? 'map-content' : ''}`} role="tabpanel" aria-label={tab}>
          {tab === 'Activity' && <><WorkspaceHeading eyebrow="A VISIBLE CHAIN OF WORK" title={current ? 'The investigation, step by step.' : 'Every action has a trace.'} detail="Delegations, source checks and evidence gaps appear here as they happen." />
            {!view?.events.length ? <Empty icon={Activity} title="Your mission starts the investigation." detail="The coordinator brings in the specialists it needs." />
              : <ol className="action-timeline">{view.events.filter(e => e.kind !== 'model_receipt').map(event => <li key={event.seq} className={event.kind === 'hold' || event.kind === 'source_unavailable' ? 'event-hold' : ''}>
                <span className="timeline-icon">{event.kind === 'task_started' ? <Circle size={13} /> : event.kind === 'evidence_gap' || event.kind === 'assessment_invalidated' ? <AlertTriangle size={13} /> : event.kind === 'hold' ? <Shield size={13} /> : <Check size={13} />}</span><div className="event-body"><div className="event-meta"><strong>{({ recon: 'Reconnaissance', mapping: 'Community mapping', checker: 'Independent checker', intake: 'Report intake', logistics: 'Planning / logistics' } as Record<string, string>)[event.actor] ?? 'Mission Coordinator'}</strong><time>{time(event.at)}</time></div><p>{event.detail}</p>
                  {event.evidenceIds.length > 0 && <button className="trace-link" onClick={() => setTab(event.kind === 'query' || event.kind === 'assessment_invalidated' ? 'Brief' : 'Evidence')}>{event.evidenceIds.length} linked reference{event.evidenceIds.length === 1 ? '' : 's'}<ArrowUpRight size={12} /></button>}
                  {event.taskId && <details><summary>Task reference</summary><code>{event.taskId}</code>{event.parentTaskId && <small>Delegated by {event.parentTaskId}</small>}</details>}
                </div></li>)}</ol>}
            {!!view?.events.some(e => e.kind === 'model_receipt') && <details className="model-receipts"><summary>Model routing receipts</summary>{view.events.filter(e => e.kind === 'model_receipt').map(e => { const receipt = JSON.parse(e.detail); return <p key={e.seq}>{receipt.responseModel ?? 'Unreported model'} · {receipt.requestedMode} · {receipt.durationMs} ms</p>; })}</details>}
          </>}
          {tab === 'Map' && view && <CommunityMapView view={view} />}
          {tab === 'Evidence' && <><WorkspaceHeading eyebrow="WHAT REACHED THE SYSTEM" title="Community evidence." detail="Reports remain unverified claims. Repeated submissions and forwards do not establish independent corroboration." />
            <div className="evidence-source"><span>{view?.mode === 'offline-replay' ? 'Offline fixture' : 'KoboToolbox'} · {view?.sourceStatus ?? 'unchecked'}</span>{view?.checkedAt && <time>Checked {time(view.checkedAt)}</time>}{view?.projectUrl && <a href={view.projectUrl} target="_blank" rel="noreferrer">Open private project<ArrowUpRight size={13} /></a>}</div>
            {view?.signals.length ? <div className="evidence-list">{view.signals.map(signal => <article key={signal.id}><div className="report-title"><h3>{signal.placeName}</h3><span className={signal.mode === 'demo' ? 'demo-badge' : 'live-badge'}>{signal.mode === 'demo' ? 'DEMONSTRATION' : 'LIVE · UNVERIFIED'}</span></div><p>{signal.category.replaceAll('_', ' ')} · {signal.relation === 'direct' ? 'Claimed direct observation' : signal.relation}</p><dl><div><dt>Observed</dt><dd>{new Date(signal.observedAt).toLocaleString()}</dd></div><div><dt>Received</dt><dd>{new Date(signal.receivedAt).toLocaleString()}</dd></div><div><dt>Origin</dt><dd>Unverified</dd></div><div><dt>Location</dt><dd>{view.groundings.find(g => g.signalId === signal.id)?.gap ?? 'Not grounded yet'}</dd></div></dl><code>{signal.id}</code></article>)}</div>
              : <Empty icon={Radio} title="No reports retrieved yet." detail="An empty feed does not mean an area is clear." />}
          </>}
          {tab === 'Brief' && <><WorkspaceHeading eyebrow="READY FOR THE NEXT DECISION" title="The mission brief." detail="A concise record of findings and the evidence still required." />{current?.result ? <div className="brief-body"><span className="hold-status"><Shield size={15} />Operational planning on hold</span><h3>{current.result.summary}</h3>{view && <FederatedPlanning view={view} />}<h4>Evidence needed</h4><ul>{current.result.gaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul><div className="brief-footnote">Mapped roads and facilities provide context. They do not establish current passability, service availability or permission to travel.</div></div>
            : <Empty icon={FileText} title="The brief follows the investigation." detail="Findings link back to source reports and checks." />}</>}
        </div>
      </section>
    </main>
  </div>;
}
function WorkspaceHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) { return <div className="workspace-heading"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{detail}</p></div>; }
function Empty({ icon: Icon, title, detail }: { icon: typeof Activity; title: string; detail: string }) { return <div className="empty-workspace"><Icon size={29} strokeWidth={1} /><p>{title}</p><span>{detail}</span></div>; }
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
