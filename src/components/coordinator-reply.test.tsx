import {render,screen,cleanup} from '@testing-library/react';
import {CoordinatorReply} from './coordinator-reply';
import type {ConversationTurn} from '../lib/server/mission-journal';
import type {MissionDocument} from '../lib/mission-artifacts';
const turn:ConversationTurn={id:'turn-test',sessionId:'session-test',message:'Hello',reply:null,mode:'live-model',status:'pending',action:null,runId:null,createdAt:new Date().toISOString(),receipt:null};
afterEach(cleanup);
it('replaces the waiting state with the first provider text while the turn is still pending',()=>{
  const document={id:'doc-test',kind:'reply',status:'streaming',markdown:'Hello, let us prepare your mission.',metadata:{}} as MissionDocument;
  const {rerender}=render(<CoordinatorReply turn={turn}/>);
  expect(screen.getByRole('status',{name:'Preparing your reply'})).toBeTruthy();
  rerender(<CoordinatorReply turn={turn} document={document}/>);
  expect(screen.getByText('Hello, let us prepare your mission.')).toBeTruthy();
  expect(screen.queryByRole('status',{name:'Preparing your reply'})).toBeNull();
});
