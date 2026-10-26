import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SaxesParser } from 'saxes';
import { parseFragment } from 'parse5';
import type { MissionEvidence, FederatedEvidence } from './community-evidence';
import type { KoboSnapshot } from './kobo';
import {z} from 'zod';
import pRetry,{AbortError} from 'p-retry';

export const RELIEFWEB_FEED = 'https://reliefweb.int/updates/rss.xml?search=Cameroon';
export const IFRC_EVENTS='https://goadmin.ifrc.org/api/v2/event/?countries__in=41&limit=8&ordering=-created_at';
const digest = (value: unknown) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export type PublicReport = { id: string; title: string; publisher: string; url: string; publishedAt: string;
  observedAt: null; contentSha256: string; excerpt: string | null;
  coverage: 'corridor_mention' | 'northwest_mention' | 'national_context'; dateBasis?:'record_created';updatedAt?:string|null;declaredStartAt?:string|null; };
export type PublicSnapshot = { source: 'ReliefWeb public RSS'|'IFRC GO public API'; sourceUrl: string; revision: string;
  status: 'available' | 'empty' | 'unavailable' | 'offline'; checkedAt: string; cached: boolean;
  reports: PublicReport[]; feedSha256: string | null; gap: string; };
export interface PublicEvidenceSource { snapshot(signal: AbortSignal, progress?: (detail: string) => void,fresh?:boolean): Promise<PublicSnapshot> }

export function htmlText(html: string): string {
  const walk = (node: ReturnType<typeof parseFragment> | any): string => {
    if (['script', 'style', 'iframe', 'object'].includes(node.nodeName)) return '';
    if (node.nodeName === '#text') return node.value;
    return (node.childNodes ?? []).map(walk).join(' ');
  };
  return walk(parseFragment(html)).replace(/\s+/g, ' ').trim();
}

/** Public RSS is a separate published interface, not an unapproved API appname. */
export function parsePublicFeed(xml: string, asOf: number): PublicReport[] {
  if (Buffer.byteLength(xml) > 1_000_000) throw new Error('Public feed exceeds its size budget.');
  const parser = new SaxesParser({ xmlns: false });
  const items: Record<string, string>[] = [], stack: string[] = [];
  let item: Record<string, string> | null = null;
  parser.on('doctype', () => { throw new Error('Public feed declarations are unsupported.'); });
  parser.on('error', () => { throw new Error('Public feed is malformed.'); });
  parser.on('opentag', tag => { stack.push(tag.name); if (tag.name === 'item') item = {}; });
  const text = (value: string) => {
    if (item && stack.length >= 2) {
      const field = stack.at(-1)!;
      if (['title', 'link', 'guid', 'pubDate', 'source', 'description'].includes(field)) item[field] = (item[field] ?? '') + value;
    }
  };
  parser.on('text', text); parser.on('cdata', text);
  parser.on('closetag', tag => { if (tag.name === 'item' && item) { items.push(item); item = null; } stack.pop(); });
  parser.write(xml).close();
  if (!items.length && !/<rss\b/.test(xml)) throw new Error('Public response is not an RSS feed.');
  const reports = new Map<string, PublicReport>();
  for (const value of items) {
    const url = new URL(value['link']?.trim() ?? '', 'https://reliefweb.int');
    // Cross-country results are not silently treated as corridor reports.
    if (url.origin !== 'https://reliefweb.int' || !url.pathname.startsWith('/report/cameroon/') || url.username || url.password) continue;
    const title = htmlText(value['title'] ?? ''), body = htmlText(value['description'] ?? '');
    const date = Date.parse(value['pubDate'] ?? '');
    if (!title || title.length > 600 || !Number.isFinite(date) || date > asOf + 5 * 60_000) continue;
    const publisher = htmlText(value['source'] ?? '') || body.match(/\bSource:\s*(.+?)(?=\s+(?:Please refer|View|Download|Attachments|Introduction|Overview)|$)/)?.[1]?.slice(0, 180) || 'Publisher not supplied in feed';
    const sentences = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(body)].map(part => part.segment.trim())
      .filter(sentence => sentence.split(/\s+/).length <= 24 && /[.!?]$/.test(sentence) && sentence.length > 35 && !/^Countries?:|^Sources?:/i.test(sentence));
    const excerpt = sentences.find(sentence => /Bamenda|Bambili|Bambui|North.?West|Nord.?Ouest/i.test(sentence)) ?? sentences[0] ?? null;
    const coverage = /Bamenda|Bambili|Bambui/i.test(body) ? 'corridor_mention' : /North.?West|Nord.?Ouest/i.test(body) ? 'northwest_mention' : 'national_context';
    const publishedAt = new Date(date).toISOString(), contentSha256 = digest(body);
    const report: PublicReport = { id: digest([url.href, publishedAt, contentSha256]), title, publisher, url: url.href,
      publishedAt, observedAt: null, contentSha256, excerpt, coverage };
    const previous = reports.get(url.href);
    if (previous && previous.contentSha256 !== report.contentSha256) throw new Error('Conflicting public feed versions in one response.');
    reports.set(url.href, report);
  }
  return [...reports.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id)).slice(0, 8);
}

export function publicGap(status: PublicSnapshot['status']): string {
  return status === 'available' ? 'ReliefWeb RSS supplies a bounded recent Cameroon report window, not a complete archive or checkpoint feed. Publication time is not observation time. A place-name mention is not local incident corroboration; road conditions and facility capacity still require recent local confirmation.'
    : status === 'empty' ? 'The public feed returned no eligible Cameroon reports in its bounded window. This does not establish no incidents or a clear road.'
    : status === 'offline' ? 'Public-source retrieval is explicitly offline or not configured for this injected source; no live public evidence was fetched.'
    : 'The public source could not be refreshed. Its coverage is unavailable; cached history is not silently promoted to current evidence.';
}
function snapshot(status: PublicSnapshot['status'], checkedAt: string, reports: PublicReport[] = [], feedSha256: string | null = null): PublicSnapshot {
  return { source: 'ReliefWeb public RSS', sourceUrl: RELIEFWEB_FEED, status, checkedAt, reports, feedSha256, cached: false,
    revision: digest({ source: RELIEFWEB_FEED, status, reports }), gap: publicGap(status) };
}
export class OfflinePublicEvidence implements PublicEvidenceSource {
  async snapshot(signal: AbortSignal) { signal.throwIfAborted(); return snapshot('offline', new Date().toISOString()); }
}
export class ReliefWebPublicEvidence implements PublicEvidenceSource {
  private cached: PublicSnapshot | null = null;
  constructor(private readonly options: { fetch?: typeof fetch; directory?: string; now?: () => number; ttlMs?: number } = {}) {}
  async snapshot(signal: AbortSignal, progress?: (detail: string) => void,fresh=false): Promise<PublicSnapshot> {
    signal.throwIfAborted(); const now = (this.options.now ?? Date.now)(), checkedAt = new Date(now).toISOString();
    if (!fresh && this.cached && now - Date.parse(this.cached.checkedAt) < (this.options.ttlMs ?? 60_000)) {
      progress?.('Mission Expert reused the unchanged public snapshot within its 60-second fetch window; this is not another independent source.');
      return { ...structuredClone(this.cached), cached: true };
    }
    progress?.('Mission Expert → ReliefWeb public RSS: retrieve recent Cameroon reports, publication times and source links.');
    try {
      const response = await (this.options.fetch ?? fetch)(RELIEFWEB_FEED, { signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]), redirect: 'error' });
      if (!response.ok || Number(response.headers.get('content-length')) > 1_000_000 || !response.body) throw new Error('Public feed unavailable.');
      const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
      try { while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length;
        if (size > 1_000_000) throw new Error('Public feed exceeds its size budget.'); chunks.push(next.value); } }
      finally { await reader.cancel(); }
      signal.throwIfAborted(); const xml = Buffer.concat(chunks).toString('utf8'), reports = parsePublicFeed(xml, now);
      const result = snapshot(reports.length ? 'available' : 'empty', checkedAt, reports, digest(xml));
      if (this.options.directory) {
        const folder = resolve(this.options.directory); mkdirSync(folder, { recursive: true });
        // Full publisher text is local audit material; shared output gets one short excerpt per source.
        writeFileSync(resolve(folder, `${result.feedSha256}.xml`), xml);
        writeFileSync(resolve(folder, `${result.revision}.json`), JSON.stringify(result, null, 2) + '\n');
      }
      this.cached = result;
      progress?.(`Mission Expert retrieved ${reports.length} eligible public reports. Publication dates and coverage limits are retained; none confirms a corridor road open.`);
      return structuredClone(result);
    } catch {
      signal.throwIfAborted();
      progress?.('Mission Expert: public retrieval failed. The gap is visible; earlier articles are not silently presented as refreshed.');
      return snapshot('unavailable', checkedAt);
    }
  }
}

/** The documented unauthenticated API exposes public records only. Never use private contact fields. */
export function parseIfrcEvents(input:unknown,asOf:number):PublicReport[] {
  const event=z.object({id:z.number().int().positive(),name:z.string().min(1).max(600),created_at:z.string(),updated_at:z.string().nullable().optional(),
    disaster_start_date:z.string().nullable().optional(),countries:z.array(z.object({id:z.number(),iso3:z.string().nullable()}))});
  const result=z.object({results:z.array(event).max(8)}).parse(input),reports=new Map<number,PublicReport>();
  const date=(value:string|null|undefined)=>value && Number.isFinite(Date.parse(value)) && Date.parse(value)<=asOf+300_000?new Date(value).toISOString():null;
  for(const item of result.results){
    if(!item.countries.some(country=>country.id===41 && country.iso3==='CMR'))continue;
    const created=date(item.created_at);if(!created)continue;
    const safe={id:item.id,name:htmlText(item.name),createdAt:created,updatedAt:date(item.updated_at),declaredStartAt:date(item.disaster_start_date)};
    const report:PublicReport={id:digest(safe),title:safe.name,publisher:'IFRC GO',url:`https://goadmin.ifrc.org/api/v2/event/${item.id}/`,
      publishedAt:created,dateBasis:'record_created',updatedAt:safe.updatedAt,declaredStartAt:safe.declaredStartAt,observedAt:null,
      contentSha256:digest(safe),excerpt:null,coverage:'national_context'};
    if(reports.has(item.id) && reports.get(item.id)!.id!==report.id)throw new Error('Conflicting IFRC event versions.');
    reports.set(item.id,report);
  }
  return [...reports.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.id.localeCompare(b.id));
}
export class IfrcPublicEvidence implements PublicEvidenceSource {
  private cached:PublicSnapshot|null=null;
  constructor(private readonly options:{fetch?:typeof fetch;directory?:string;now?:()=>number;ttlMs?:number}={}){}
  async snapshot(signal:AbortSignal,progress?:(detail:string)=>void,fresh=false):Promise<PublicSnapshot>{
    signal.throwIfAborted();const now=(this.options.now??Date.now)(),checkedAt=new Date(now).toISOString();
    if(!fresh && this.cached && now-Date.parse(this.cached.checkedAt)<(this.options.ttlMs??60_000))return {...structuredClone(this.cached),cached:true};
    progress?.('Mission Expert → IFRC GO public API: read the bounded Cameroon public event window. Record dates are not current field observations.');
    try{
      const reports=await pRetry(async()=>{
        try{
          const current=await (this.options.fetch??fetch)(IFRC_EVENTS,{signal:AbortSignal.any([signal,AbortSignal.timeout(20_000)]),redirect:'error'});
          if(!current.ok){await current.body?.cancel();if([408,429].includes(current.status)||current.status>=500)throw new Error('IFRC transient HTTP failure.');throw new AbortError('IFRC request rejected.');}
          if(!current.body || Number(current.headers.get('content-length'))>1_000_000)throw new AbortError('IFRC invalid or oversized response.');
          const reader=current.body.getReader(),chunks:Uint8Array[]=[];let size=0;
          try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1_000_000)throw new AbortError('IFRC size budget exceeded.');chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});}
          signal.throwIfAborted();
          try{return parseIfrcEvents(JSON.parse(Buffer.concat(chunks).toString('utf8')),now);}catch{throw new AbortError('IFRC payload validation failed.');}
        }catch(error){signal.throwIfAborted();if(error instanceof AbortError)throw error;throw new Error('IFRC transport read failed.');}
      },{retries:1,minTimeout:100,maxTimeout:100,signal,onFailedAttempt:({retriesLeft})=>{if(retriesLeft)progress?.('Mission Expert → IFRC GO: transient source failure; one bounded fresh read retry. No cached success is substituted.');}});
      const status=reports.length?'available':'empty';
      const gap='ReliefWeb RSS was unavailable. IFRC GO supplies only a bounded eight-record Cameroon public event window, not a complete archive or local incident feed. Records may be old; record creation, update and declared event start dates are not observation times or new confirmation. No present corridor road condition or facility operation is established. Public narrative and contact fields are excluded.';
      const result:PublicSnapshot={source:'IFRC GO public API',sourceUrl:IFRC_EVENTS,status,checkedAt,cached:false,reports,feedSha256:null,gap,
        revision:digest({source:IFRC_EVENTS,status,reports,gap})};
      if(this.options.directory){mkdirSync(this.options.directory,{recursive:true});writeFileSync(resolve(this.options.directory,`${result.revision}.json`),JSON.stringify(result,null,2)+'\n');}
      this.cached=result;progress?.(`Mission Expert retrieved ${reports.length} public Cameroon IFRC records. Their dates and historical-context limits are retained.`);return structuredClone(result);
    }catch{signal.throwIfAborted();return {source:'IFRC GO public API',sourceUrl:IFRC_EVENTS,status:'unavailable',checkedAt,cached:false,reports:[],feedSha256:null,
      revision:digest({source:IFRC_EVENTS,status:'unavailable'}),gap:'ReliefWeb RSS and the IFRC GO public fallback could not be refreshed. Public coverage is unavailable; prior history is not current confirmation.'};}
  }
}
export class ResilientPublicEvidence implements PublicEvidenceSource {
  constructor(private readonly primary:PublicEvidenceSource,private readonly fallback:PublicEvidenceSource){}
  async snapshot(signal:AbortSignal,progress?:(detail:string)=>void,fresh=false){
    const result=await this.primary.snapshot(signal,progress,fresh);if(result.status!=='unavailable')return result;
    progress?.('Mission Expert: ReliefWeb is unavailable. Trying the separately documented IFRC GO public API; its records remain distinct historical context.');
    return this.fallback.snapshot(signal,progress,fresh);
  }
}

export class PublicIntegratedEvidence implements MissionEvidence {
  constructor(private readonly base: MissionEvidence, private readonly publicSource: PublicEvidenceSource,
    private readonly progress?: (detail: string) => void) {}
  async load(input: KoboSnapshot, signal: AbortSignal,options?:{freshPublic?:boolean}): Promise<FederatedEvidence> {
    const [evidence, publicEvidence] = await Promise.all([this.base.load(input, signal), this.publicSource.snapshot(signal, this.progress,options?.freshPublic)]);
    signal.throwIfAborted();
    return { ...evidence, publicEvidence, inputRevision: digest({ base: evidence.inputRevision, public: publicEvidence.revision }),
      revision: digest({ base: evidence.revision, public: publicEvidence.revision }) };
  }
}
