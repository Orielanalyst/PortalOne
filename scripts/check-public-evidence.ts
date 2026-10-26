import { ReliefWebPublicEvidence } from '../src/lib/server/public-evidence';
import { mkdirSync, writeFileSync } from 'node:fs';
if (!process.argv.includes('--live')) {
  console.log('Use --live to read the public Cameroon RSS feed once. No account, credentials, private Kobo record or model call is used.');
  process.exit(0);
}
const result = await new ReliefWebPublicEvidence({ directory: '.runtime/public-evidence', ttlMs: 0 }).snapshot(AbortSignal.timeout(25_000));
const receipt = { checkedAt: result.checkedAt, source: result.source, url: result.sourceUrl, status: result.status, revision: result.revision,
  feedSha256: result.feedSha256, reports: result.reports.map(r => ({ id: r.id, title: r.title, publisher: r.publisher, url: r.url,
    publishedAt: r.publishedAt, observedAt: r.observedAt, contentSha256: r.contentSha256, coverage: r.coverage, excerptWords: r.excerpt?.split(/\s+/).length ?? 0 })), gap: result.gap };
mkdirSync('.runtime/public-evidence', { recursive: true });
writeFileSync('.runtime/public-evidence/check.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, reports: result.reports.length, revision: result.revision, receipt: '.runtime/public-evidence/check.json' }));
if (result.status !== 'available') process.exitCode = 1;
