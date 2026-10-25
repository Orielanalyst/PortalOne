import { configuredKobo } from '../src/lib/server/kobo';
import { CommunityMap } from '../src/lib/server/community-map';
import { ZetarisCommunityEvidence, FixtureCommunityEvidence } from '../src/lib/server/community-evidence';
import { isDeepStrictEqual } from 'node:util';
import { mkdirSync, writeFileSync } from 'node:fs';

const signal = AbortSignal.timeout(90_000), map = new CommunityMap();
const snapshot = await configuredKobo().snapshot(signal);
const actual = await new ZetarisCommunityEvidence(map).load(snapshot, signal);
const expected = await new FixtureCommunityEvidence(map).load(snapshot, signal);
if (!isDeepStrictEqual(actual.rows, expected.rows) || actual.revision !== expected.revision) throw new Error('Federated result differs from independent local calculation.');
mkdirSync('.runtime/community-v1', { recursive: true });
writeFileSync('.runtime/community-v1/check.json', JSON.stringify(actual, null, 2) + '\n');
console.log(JSON.stringify({ mode: actual.mode, matchedIndependentCalculation: true, inputRevision: actual.inputRevision,
  reports: actual.reportCount, demo: actual.demoCount, live: actual.liveCount, rows: actual.rows,
  queries: actual.queries.map(q => ({ name: q.name, rowCount: q.rowCount, durationMs: q.durationMs })) }, null, 2));
