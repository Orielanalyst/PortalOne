import { Streamdown,parseMarkdownIntoBlocks } from 'streamdown';
import 'streamdown/styles.css';
// Extend the acquired parser only for the ambiguous, still-arriving table header.
// Completed blocks and code fences continue through Streamdown unchanged.
const tableHeader={name:'mission-table-header',priority:110,handle(text:string){
  const tail=parseMarkdownIntoBlocks(text).at(-1) ?? '';
  if(!tail.trimStart().startsWith('|'))return text;
  const prefix=text.slice(0,text.lastIndexOf(tail));
  const [header,...rest]=tail.trimEnd().split('\n');
  if(rest[0] && /^\s*\|?\s*:?-+:?\s*\|/.test(rest[0]) && rest[0].replace(/[|:\-\s]/g,'')==='')return text;
  if(rest.some(line=>line.replace(/[|:\-\s]/g,'')!==''))return text;
  if(!header?.trimEnd().endsWith('|') || header.trim()==='|')return prefix;
  const cells=header.trim().slice(1,-1).split(/(?<!\\)\|/);
  return prefix+(cells.length>1?`${header}\n| ${cells.map(()=>'---').join(' | ')} |\n`:'');
}};
export function MissionMarkdown({ text, streaming = false, runId }: { text: string; streaming?: boolean; runId?: string | null }) {
  const linked = runId ? text.replace(/\[(E[a-f0-9]{10})\](?!\()/g, (_,id:string)=>`[${id}](/api/mission/evidence?run=${encodeURIComponent(runId)}&id=${id})`) : text;
  return <Streamdown className="mission-markdown" mode="streaming" parseIncompleteMarkdown isAnimating={streaming} controls={false} lineNumbers={false} remend={streaming?{handlers:[tableHeader]}:undefined}
    components={{ strong:({children})=><strong>{children}</strong>,em:({children})=><em>{children}</em>,img:()=>null, a:({href,children})=>href && (href.startsWith('/api/mission/evidence?') || href.startsWith('https://'))
      ? <a href={href} target="_blank" rel="noreferrer">{children}</a> : <span>{children}</span> }}>{linked}</Streamdown>;
}
