import type {ConversationTurn} from '../lib/server/mission-journal';
import type {MissionDocument} from '../lib/mission-artifacts';
import {AgentLoading} from './agent-loading';
import {MissionMarkdown} from './mission-markdown';
export function CoordinatorReply({turn,document}:{turn:ConversationTurn;document?:MissionDocument}){
  if(turn.status==='pending'&&!document?.markdown&&!turn.reply)return <AgentLoading startedAt={turn.createdAt} title="Preparing your reply" detail="Clarifying the mission before delegating work."/>;
  return <MissionMarkdown text={(document?.status!=='failed'&&document?.markdown)||turn.reply||'Reading your message…'} streaming={document?.status==='streaming'}/>;
}
