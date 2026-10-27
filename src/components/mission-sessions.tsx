import {Plus,MessagesSquare} from 'lucide-react';
import type {MissionView} from '../lib/server/mission-runtime';
import './mission-sessions.css';

export function MissionSessions({view,busy,starting,onNew,onSelect}:{view:MissionView|null;busy:boolean;starting:boolean;onNew:()=>void;onSelect:(id:string)=>void}) {
  return <nav className="mission-sessions" aria-label="Mission conversations">
    <div className="mission-session-controls">
      <button type="button" onClick={onNew} disabled={busy||starting} title="Start a separate conversation with fresh mission inputs. Earlier missions are kept."><Plus size={14}/>{starting?'Starting…':'New mission'}</button>
      <label><MessagesSquare size={14}/><span className="mission-session-label">Mission history</span>
        <select aria-label="Mission history" value={view?.session?.id??''} disabled={!view?.sessions?.length||starting} onChange={event=>onSelect(event.target.value)}>
          {!view?.sessions?.length&&<option value="">Loading missions…</option>}
          {view?.sessions?.map(session=><option key={session.id} value={session.id}>{session.title}{session.runCount?` · ${session.runCount} investigation${session.runCount===1?'':'s'}`:''}</option>)}
        </select>
      </label>
    </div>
    <p>{view?.session?.turnCount===0?'A fresh mission. Tell the coordinator what you want to prepare.':'Each mission keeps its own conversation, inputs and investigation history.'}</p>
  </nav>;
}
