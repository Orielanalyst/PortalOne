import {useEffect,useState} from 'react';
import {Waves} from 'lucide-react';

export function AgentLoading({startedAt,title='Preparing your reply',detail='Your coordinator is working on your message.'}:{startedAt:string;title?:string;detail?:string}){
  const [seconds,setSeconds]=useState(0);
  useEffect(()=>{const update=()=>setSeconds(Math.max(0,Math.floor((Date.now()-Date.parse(startedAt))/1000)));update();const timer=setInterval(update,1000);return()=>clearInterval(timer);},[startedAt]);
  return <div className="agent-loading" role="status" aria-label={title}>
    <div className="agent-loading-symbol" aria-hidden="true"><Waves size={20}/><span/></div>
    <div className="agent-loading-copy"><strong>{title}</strong><p>{seconds>=20?'Still working. '+detail:detail}</p><div className="agent-loading-lines" aria-hidden="true"><span/><span/></div></div>
    <time aria-label="Elapsed time">{seconds}s</time>
  </div>;
}
