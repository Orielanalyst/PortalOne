import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SaxesParser } from 'saxes';
import { parseFragment } from 'parse5';
import type { MissionEvidence, FederatedEvidence } from './community-evidence';
import type { KoboSnapshot } from './kobo';

export const RELIEFWEB_FEED = 'https://reliefweb.int/updates/rss.xml?search=Cameroon';
const digest = (value: unknown) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export type PublicReport = { id: string; title: string; publisher: string; url: string; publishedAt: string;
  observedAt: null; contentSha256: string; excerpt: string | null;
  coverage: 'corridor_mention' | 'northwest_mention' | 'national_context'; };
export type PublicSnapshot = { source: 'ReliefWeb public RSS'; sourceUrl: string; revision: string;
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
