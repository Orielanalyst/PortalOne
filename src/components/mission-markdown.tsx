import { Streamdown } from 'streamdown';
import 'streamdown/styles.css';
export function MissionMarkdown({ text, streaming = false, runId }: { text: string; streaming?: boolean; runId?: string | null }) {
  const linked = runId ? text.replace(/\[(E[a-f0-9]{10})\](?!\()/g, (_,id:string)=>`[${id}](/api/mission/evidence?run=${encodeURIComponent(runId)}&id=${id})`) : text;
  return <Streamdown className="mission-markdown" mode="streaming" parseIncompleteMarkdown isAnimating={streaming} controls={false} lineNumbers={false}
    components={{ strong:({children})=><strong>{children}</strong>,em:({children})=><em>{children}</em>,img:()=>null, a:({href,children})=>href && (href.startsWith('/api/mission/evidence?') || href.startsWith('https://'))
      ? <a href={href} target="_blank" rel="noreferrer">{children}</a> : <span>{children}</span> }}>{linked}</Streamdown>;
}
