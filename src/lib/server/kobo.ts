import { z } from 'zod';
import { createHash } from 'node:crypto';

const record = z.object({
  _id: z.number().int().positive(), _uuid: z.string().min(1).max(128),
  report_mode: z.enum(['demo', 'live']), observed_at: z.iso.datetime({ offset: true }),
  place_name: z.string().trim().min(1).max(200), location: z.string().max(160).optional(),
  category: z.enum(['road_blockage', 'road_condition', 'access_restriction', 'service_status', 'supply_need', 'weather', 'other']),
  report_text: z.string().trim().min(1).max(2000),
  source_relation: z.enum(['direct', 'forwarded', 'reported']), origin_reference: z.string().max(200).optional(),
}).passthrough();
export type CommunitySignal = {
  id: string; sourceKey: string; source: 'kobo'; projectUid: string; submissionId: number;
  mode: 'demo' | 'live'; observedAt: string; receivedAt: string;
  placeName: string; category: z.infer<typeof record>['category']; relation: 'direct' | 'forwarded' | 'reported';
  claimedOrigin: string | null; originVerified: false; contentFingerprint: string;
  location: { lat: number; lng: number; accuracyMetres: number | null } | null;
};
export type SignalInput = { signal: CommunitySignal; raw: unknown };
export type KoboSnapshot = { sourceId: string; checkedAt: string; count: number; records: SignalInput[] };
export function officialKoboServer(input: string) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || !['kf.kobotoolbox.org', 'eu.kobotoolbox.org'].includes(url.hostname) ||
      url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) throw new Error('Use an official Kobo HTTPS origin.');
  return url.origin;
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function normalizeKobo(raw: unknown, projectUid: string, receivedAt: string): SignalInput {
  const value = record.parse(raw);
  const gps = value.location?.trim().split(/\s+/).map(Number);
  if (gps && (gps.length !== 4 || gps.some(n => !Number.isFinite(n)) || Math.abs(gps[0]!) > 90 || Math.abs(gps[1]!) > 180 || gps[3]! < 0)) throw new Error('Invalid Kobo geopoint.');
  const sourceKey = `kobo:${projectUid}:${value._id}`;
  // Only observation fields form the version: changing API export metadata is not a new report.
  const version = JSON.stringify([value._uuid, value.report_mode, value.observed_at, value.place_name,
    value.location ?? '', value.category, value.report_text, value.source_relation, value.origin_reference ?? '']);
  return { raw, signal: { id: `signal-${hash(sourceKey + version).slice(0, 32)}`, sourceKey, source: 'kobo', projectUid,
    submissionId: value._id, mode: value.report_mode, observedAt: value.observed_at, receivedAt,
    placeName: value.place_name, category: value.category, relation: value.source_relation,
    claimedOrigin: value.origin_reference?.trim() || null, originVerified: false,
    contentFingerprint: hash(value.report_text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()),
    location: gps ? { lat: gps[0]!, lng: gps[1]!, accuracyMetres: gps[3] === 0 ? null : gps[3]! } : null } };
}

/** Full bounded reconciliation sees edits to earlier IDs; no increment-only cursor loses them. */
export class KoboClient {
  readonly origin: string;
  readonly sourceId: string;
  constructor(private readonly options: { server: string; projectUid: string; token: string; fetch?: typeof fetch }) {
    this.origin = officialKoboServer(options.server);
    if (!/^[a-zA-Z0-9]{8,64}$/.test(options.projectUid) || !options.token.trim()) throw new Error('Kobo local configuration is incomplete.');
    this.sourceId = `kobo:${options.projectUid}`;
  }
  async snapshot(signal?: AbortSignal): Promise<KoboSnapshot> {
    const checkedAt = new Date().toISOString();
    const records: SignalInput[] = [], seen = new Set<number>();
    let count: number | null = null;
    for (let start = 0; start < 1000; start += 100) {
      const url = new URL(`/api/v2/assets/${this.options.projectUid}/data/`, this.origin);
      url.searchParams.set('limit', '100'); url.searchParams.set('start', String(start)); url.searchParams.set('sort', '{"_id":1}');
      const response = await (this.options.fetch ?? fetch)(url, { headers: { Authorization: `Token ${this.options.token}`, Accept: 'application/json' },
        redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`Kobo read failed (HTTP ${response.status}).`);
      const text = await response.text();
      if (text.length > 2_000_000) throw new Error('Kobo page exceeded its size budget.');
      const page = z.object({ count: z.number().int().min(0).max(1000), next: z.string().nullable(), results: z.array(z.unknown()).max(100) }).parse(JSON.parse(text));
      if (count !== null && count !== page.count) throw new Error('Kobo changed during pagination; retry a complete scan.');
      count = page.count;
      for (const raw of page.results) {
        const input = normalizeKobo(raw, this.options.projectUid, checkedAt);
        if (seen.has(input.signal.submissionId)) throw new Error('Kobo pagination repeated an ID; retry a complete scan.');
        seen.add(input.signal.submissionId); records.push(input);
      }
      if (!page.next) {
        if (records.length !== count) throw new Error('Kobo scan was incomplete.');
        return { sourceId: this.sourceId, checkedAt, count, records };
      }
      if (!page.results.length) throw new Error('Kobo returned an empty intermediate page.');
    }
    throw new Error('Kobo scan exceeded 1000 records; narrow the project before proceeding.');
  }
}
export function configuredKobo() {
  return new KoboClient({ server: process.env['KOBO_SERVER_URL'] || 'https://kf.kobotoolbox.org',
    projectUid: process.env['KOBO_PROJECT_UID'] || '', token: process.env['KOBO_API_TOKEN'] || '' });
}
