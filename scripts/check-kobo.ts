import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { configuredKobo } from '../src/lib/server/kobo';
import { CommunityMap } from '../src/lib/server/community-map';

const client = configuredKobo();
mkdirSync('.runtime/kobo', { recursive: true });
const place = process.argv.includes('--demo-place=Balewa') ? 'Balewa' : process.argv.includes('--demo-place=Bambui') ? 'Bambui' : 'Bambili';
const missionUpdateDemo=process.argv.includes('--demo-case=mission-update');
const demoTag=process.argv.find(argument=>argument.startsWith('--demo-tag='))?.slice('--demo-tag='.length) ?? '';
if(demoTag && !/^[a-z0-9-]{1,32}$/.test(demoTag))throw new Error('Invalid demonstration tag.');
const blockageDemo = process.argv.includes('--demo-case=road-blockage') || missionUpdateDemo;
if (blockageDemo && place !== 'Bambili') throw new Error('The blockage demonstration is scoped to Bambili only.');
const proofPath = missionUpdateDemo ? `.runtime/kobo/transport-test-mission-update${demoTag?'-'+demoTag:''}.json` : blockageDemo ? '.runtime/kobo/transport-test-road-blockage.json' : place === 'Bambili' ? '.runtime/kobo/transport-test.json' : `.runtime/kobo/transport-test-${place.toLowerCase()}.json`;
if (process.argv.includes('--submit-demo')) {
  // Persist the UUID before the write, so an uncertain network result can be retried without a fresh incident.
  const fixture = existsSync(proofPath) ? JSON.parse(readFileSync(proofPath, 'utf8')) : {
    uuid: randomUUID(), at: new Date().toISOString(), projectUid: process.env['KOBO_PROJECT_UID'],
  };
  if (fixture.projectUid !== process.env['KOBO_PROJECT_UID']) throw new Error('Existing transport fixture belongs to a different project.');
  writeFileSync(proofPath, JSON.stringify(fixture, null, 2) + '\n');
  const existing = await client.snapshot();
  if (!existing.records.some(r => (r.raw as Record<string, unknown>)['_uuid'] === fixture.uuid)) {
    const uid = fixture.projectUid;
    // Deployment replaces the draft id_string with the asset UID (verified through OpenRosa formList).
    const category = blockageDemo ? 'road_blockage' : 'other';
    const relation = blockageDemo ? 'forwarded' : 'direct';
    const text = missionUpdateDemo ? 'DEMONSTRATION ONLY: synthetic forwarded access-constraint marker at the mapped Bambili community reference. Coordinates are a public map reference selected for the mission-update rehearsal, not a field observation. No actual incident is asserted.' : blockageDemo ? 'DEMONSTRATION ONLY: scripted example of a forwarded road-obstruction report near Bambili. This is not an actual incident.' : 'DEMONSTRATION ONLY: report transport smoke test. No incident, need or road condition is asserted.';
    const reference=missionUpdateDemo?new CommunityMap().places.find(item=>item.name==='Bambili'):null;
    if(missionUpdateDemo && !reference)throw new Error('Missing public map reference for the labelled demonstration.');
    const geopoint=reference?`<location>${reference.lat.toFixed(3)} ${reference.lng.toFixed(3)} 0 100</location>`:'';
    const xml = `<?xml version="1.0"?><${uid} id="${uid}"><report_mode>demo</report_mode><observed_at>${fixture.at}</observed_at><place_name>${place}</place_name>${geopoint}<category>${category}</category><report_text>${text}</report_text><source_relation>${relation}</source_relation><origin_reference>transport-smoke-v1</origin_reference><meta><instanceID>uuid:${fixture.uuid}</instanceID></meta></${uid}>`;
    const body = new FormData(); body.append('xml_submission_file', new Blob([xml], { type: 'text/xml' }), 'submission.xml');
    // Current KPI includes OpenRosa; legacy kc.* submission URLs can return 404.
    const origin = client.origin;
    const response = await fetch(`${origin}/submission`, { method: 'POST', body, redirect: 'error',
      headers: { Authorization: `Token ${process.env['KOBO_API_TOKEN']}`, 'X-OpenRosa-Version': '1.0' }, signal: AbortSignal.timeout(30_000) });
    if (![201, 202].includes(response.status)) {
      writeFileSync('.runtime/kobo/submit-error.txt', await response.text());
      throw new Error(`Kobo demonstration submit returned HTTP ${response.status}; inspect locally, do not create a new UUID.`);
    }
    console.log(JSON.stringify({ demonstrationSubmitStatus: response.status }));
  }
}
const snapshot = await client.snapshot();
const proof = { checkedAt: snapshot.checkedAt, sourceId: snapshot.sourceId, retrieved: snapshot.count,
  demo: snapshot.records.filter(r => r.signal.mode === 'demo').length,
  live: snapshot.records.filter(r => r.signal.mode === 'live').length,
  reportIds: snapshot.records.map(r => r.signal.id), note: 'Live API transport does not establish incident truth or independent origins.' };
writeFileSync('.runtime/kobo/intake-receipt.json', JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof, null, 2));
