import type {EvidenceCitation} from '../mission-artifacts';

/** Resolve short model source handles against the exact supplied catalogue. */
export class CitationStream {
  readonly sources:Record<string,string>;
  private pending='';
  private raw='';
  private visible='';
  private unknown=false;
  constructor(citations:Pick<EvidenceCitation,'id'>[],private readonly emit:(text:string)=>void) {
    this.sources=Object.fromEntries(citations.map((citation,index)=>[`S${index+1}`,citation.id]));
  }
  encode(text:string) {
    const reverse=new Map(Object.entries(this.sources).map(([handle,id])=>[id,handle]));
    return text.replace(/\[(E[a-f0-9]{10})\]/g,(_,id:string)=>reverse.has(id)?`[${reverse.get(id)}]`:'[superseded source]');
  }
  push(delta:string,complete=false) {
    this.raw+=delta;this.pending+=delta;
    let boundary=this.pending.length;
    if(!complete) {
      const bracket=this.pending.lastIndexOf('[');
      if(bracket>=0 && /^\[(?:S[\dS\s,–-]*)?$/.test(this.pending.slice(bracket)))boundary=bracket;
    }
    const text=this.pending.slice(0,boundary).replace(/\[(S[\dS\s,–-]+)\]/g,(_,group:string)=>{
      const handles:string[]=[];
      for(const part of group.split(',')) {
        const match=part.trim().match(/^S(\d+)(?:\s*[–-]\s*S?(\d+))?$/);
        const first=Number(match?.[1]),last=Number(match?.[2] ?? match?.[1]);
        if(!match || last<first || last-first>=Object.keys(this.sources).length){this.unknown=true;return '[source reference unresolved]';}
        for(let index=first;index<=last;index++)handles.push(`S${index}`);
      }
      return handles.map(handle=>{const id=this.sources[handle];if(!id){this.unknown=true;return '[source reference unresolved]';}return `[${id}]`;}).join('');
    });
    this.pending=this.pending.slice(boundary);this.visible+=text;if(text)this.emit(text);
  }
  finish(providerContent:string) {
    if(providerContent!==this.raw)throw new Error('Provider stream and completed answer differ.');
    this.push('',true);
    if(this.unknown || /\[E[a-f0-9]{10}\]/.test(providerContent) || providerContent.replace(/\[S[\dS\s,–-]+\]/g,'').includes('[S') || /\[(source required|superseded source)\]/.test(providerContent))throw new Error('Use only the supplied short source handles; a source reference is unresolved.');
    return this.visible;
  }
}
