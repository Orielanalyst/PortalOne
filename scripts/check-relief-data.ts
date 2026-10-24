import { writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { FixtureReliefSource, readScenario, ZetarisReliefSource } from '../src/lib/server/relief-source';
import { configuredZetaris } from '../src/lib/server/zetaris';

const pack = readScenario();
const live = new ZetarisReliefSource(configuredZetaris());
const fixture = new FixtureReliefSource();
const cases = [];
for (const asOf of [pack.clock, pack.changedAt]) {
  const actual = await live.load(pack.mission, asOf);
  const expected = await fixture.load(pack.mission, asOf);
  if (!isDeepStrictEqual(actual.candidates, expected.candidates) ||
      !isDeepStrictEqual(actual.observations, expected.observations) || actual.dataRevision !== expected.dataRevision) {
    throw new Error('Live federation differs from the independently calculated fixture.');
  }
  cases.push(actual);
}
const receipt = { capturedAt: new Date().toISOString(), inputManifest: 'data/relief-scenario-v1/manifest.json',
  sourceMode: 'Real local Zetaris queries over synthetic Postgres and file sources',
  checks: { independentlyMatched: true, initialCandidates: cases[0]!.candidates.length,
    initialOrigins: cases[0]!.observations.length, updatedOrigins: cases[1]!.observations.length,
    rawObservations: 10, futureReportExcludedInitially: true, forwardCollapsedByOrigin: true }, cases };
if (process.argv.includes('--evidence')) writeFileSync('docs/evidence/relief-data-2026-10-24.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ capturedAt: receipt.capturedAt, checks: receipt.checks,
  queryRows: cases.flatMap(s => s.queries.map(q => ({ name: q.name, rows: q.rowCount, durationMs: q.durationMs }))) }, null, 2));
