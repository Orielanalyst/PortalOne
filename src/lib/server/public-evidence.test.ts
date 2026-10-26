// @vitest-environment node
import { parsePublicFeed, ReliefWebPublicEvidence, PublicIntegratedEvidence, OfflinePublicEvidence, parseIfrcEvents,IfrcPublicEvidence,ResilientPublicEvidence } from './public-evidence';
import { CommunityMap } from './community-map';
import { FixtureCommunityEvidence } from './community-evidence';
import { replayCommunitySource } from './mission-replay';
import { MissionWorld } from './mission-world';
import { buildDossier } from './mission-dossier';
const now = Date.parse('2026-10-26T08:00:00Z');
const article = (body = 'Access to clinics in the North-West remains constrained.', path = 'cameroon/test-report') => `<item><title>Cameroon situation report</title><link>https://reliefweb.int/report/${path}</link><pubDate>Sun, 25 Oct 2026 10:00:00 +0000</pubDate><source>Test publisher</source><description><![CDATA[<p>${body}</p><script>fabricated script content</script>]]></description></item>`;
const feed = (items = article()) => `<rss version="2.0"><channel>${items}</channel></rss>`;
it('retains source identity, publication time, a bounded source excerpt and unknown observation time', () => {
  const reports = parsePublicFeed(feed(article() + article('A regional report.', 'ghana/example')), now);
  expect(reports).toHaveLength(1);
  expect(reports[0]).toMatchObject({ publisher: 'Test publisher', publishedAt: '2026-10-25T10:00:00.000Z', observedAt: null,
    coverage: 'northwest_mention', excerpt: 'Access to clinics in the North-West remains constrained.' });
  expect(JSON.stringify(reports)).not.toContain('fabricated script');
  expect(parsePublicFeed(feed(article()), now)[0]?.id).toBe(reports[0]?.id);
});
it('rejects conflicting source versions, malformed XML and entity declarations', () => {
  expect(() => parsePublicFeed(feed(article() + article('A changed statement about clinics.')), now)).toThrow('Conflicting');
  expect(() => parsePublicFeed('<rss><item></rss>', now)).toThrow('malformed');
  expect(() => parsePublicFeed('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///private">]><rss/>', now)).toThrow('declarations');
  expect(() => parsePublicFeed('x'.repeat(1_000_001), now)).toThrow('budget');
});
it('does not publish oversized excerpts or future-dated reports and never executes source HTML', () => {
  const long = 'word '.repeat(40) + 'end.';
  expect(parsePublicFeed(feed(article(long)), now)[0]?.excerpt).toBeNull();
  expect(parsePublicFeed(feed().replace('Sun, 25 Oct 2026', 'Sun, 25 Oct 2030'), now)).toHaveLength(0);
});
it('reuses one bounded fetch window, but a failed refresh exposes a gap instead of stale success', async () => {
  let time = now;
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(feed())).mockRejectedValueOnce(new Error('unavailable'));
  const source = new ReliefWebPublicEvidence({ fetch: fetcher, now: () => time });
  const baseline = await source.snapshot(AbortSignal.timeout(1000));
  time += 30_000;
  expect(await source.snapshot(AbortSignal.timeout(1000))).toMatchObject({ revision: baseline.revision, cached: true });
  expect(fetcher).toHaveBeenCalledTimes(1);
  time += 60_000;
  const unavailable = await source.snapshot(AbortSignal.timeout(1000));
  expect(unavailable).toMatchObject({ status: 'unavailable', reports: [] });
  expect(unavailable.revision).not.toBe(baseline.revision);
  expect(unavailable.gap).toContain('not silently');
});
it('distinguishes empty, oversized, unavailable and cancelled requests', async () => {
  const empty = new ReliefWebPublicEvidence({ fetch: vi.fn().mockResolvedValue(new Response(feed(''))), now: () => now });
  expect(await empty.snapshot(AbortSignal.timeout(1000))).toMatchObject({ status: 'empty', reports: [] });
  const large = new ReliefWebPublicEvidence({ fetch: vi.fn().mockResolvedValue(new Response('x'.repeat(1_000_001))), now: () => now });
  expect(await large.snapshot(AbortSignal.timeout(1000))).toMatchObject({ status: 'unavailable' });
  await expect(empty.snapshot(AbortSignal.abort())).rejects.toThrow();
});
it('public content changes invalidate actual World Model dependencies and enter cited committee evidence', async () => {
  const map = new CommunityMap(), input = await replayCommunitySource.snapshot();
  const source = new ReliefWebPublicEvidence({ fetch: vi.fn().mockResolvedValueOnce(new Response(feed())).mockResolvedValueOnce(new Response(feed(article('A new report describes Bambui service constraints.')))), now: () => now, ttlMs: 0 });
  const integrated = new PublicIntegratedEvidence(new FixtureCommunityEvidence(map), source), world = new MissionWorld();
  const before = await integrated.load(input, AbortSignal.timeout(3000));
  await world.observe(before, 'first'); await world.recordPlan({ runId: 'first', documentId: 'plan-one', version: 1, evidence: before });
  const after = await integrated.load(input, AbortSignal.timeout(3000));
  expect(after.revision).not.toBe(before.revision);
  expect((await world.observe(after, 'second')).invalidated).toHaveLength(1);
  expect(world.view('first').plans[0]?.changes.some(c => c.label === 'Public-source content revision')).toBe(true);
  const dossier = buildDossier('second', 'Review Bambili evidence', input, after, map);
  expect(dossier.citations.filter(c => c.kind === 'public')).toHaveLength(2);
  expect(dossier.modelEvidence.some(c => c.statement.includes('not the observation date'))).toBe(true);
  expect(dossier.gaps).toContain(after.publicEvidence!.gap);
});
it('offline mode explicitly has no live public articles', async () => {
  expect(await new OfflinePublicEvidence().snapshot(AbortSignal.timeout(1000))).toMatchObject({ status: 'offline', reports: [] });
});
const ifrcEvent=(overrides:Record<string,unknown>={})=>({id:123,name:'Cameroon historical event',created_at:'2026-02-26T11:42:19Z',updated_at:'2026-03-01T10:00:00Z',disaster_start_date:'2025-12-01T00:00:00Z',countries:[{id:41,iso3:'CMR'}],summary:'Excluded public narrative',emergency_response_contact_email:'excluded@example.test',...overrides});
it('projects only public event identity and dates, verifies country identity and excludes contact/narrative fields',()=>{
  const reports=parseIfrcEvents({results:[ifrcEvent(),ifrcEvent({id:124,countries:[{id:41,iso3:'GHA'}]})]},now);
  expect(reports).toHaveLength(1);expect(reports[0]).toMatchObject({dateBasis:'record_created',observedAt:null,publishedAt:'2026-02-26T11:42:19.000Z',coverage:'national_context',declaredStartAt:'2025-12-01T00:00:00.000Z'});
  expect(JSON.stringify(reports)).not.toMatch(/Excluded|excluded@example/);
  expect(parseIfrcEvents({results:[ifrcEvent({summary:'Changed excluded narrative'})]},now)[0]?.id).toBe(reports[0]?.id);
  expect(()=>parseIfrcEvents({results:[ifrcEvent(),ifrcEvent({name:'Conflicting version'})]},now)).toThrow('Conflicting');
});
it('uses the documented fallback only after an unavailable primary, preserving dates and unavailable gaps',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({results:[ifrcEvent()]}))).mockResolvedValueOnce(new Response('',{status:503}));
  const fallback=new IfrcPublicEvidence({fetch:fetcher,now:()=>now});
  const primary={snapshot:vi.fn().mockResolvedValue({status:'unavailable'})},source=new ResilientPublicEvidence(primary,fallback);
  const result=await source.snapshot(AbortSignal.timeout(1000));expect(result).toMatchObject({source:'IFRC GO public API',status:'available'});expect(result.gap).toContain('may be old');
  expect(await fallback.snapshot(AbortSignal.timeout(1000))).toMatchObject({cached:true,revision:result.revision});expect(fetcher).toHaveBeenCalledTimes(1);
  expect(await source.snapshot(AbortSignal.timeout(1000),undefined,true)).toMatchObject({status:'unavailable',reports:[]});
  primary.snapshot.mockResolvedValue({status:'empty'});expect(await source.snapshot(AbortSignal.timeout(1000))).toMatchObject({status:'empty'});expect(fetcher).toHaveBeenCalledTimes(2);
});
it('rejects oversized or invalid IFRC windows and exposes no successful snapshot on failure',async()=>{
  expect(()=>parseIfrcEvents({results:Array.from({length:9},()=>ifrcEvent())},now)).toThrow();
  expect(parseIfrcEvents({results:[ifrcEvent({created_at:'2030-01-01T00:00:00Z'})]},now)).toHaveLength(0);
  const source=new IfrcPublicEvidence({fetch:vi.fn().mockResolvedValue(new Response('x'.repeat(1_000_001))),now:()=>now});
  expect(await source.snapshot(AbortSignal.timeout(1000))).toMatchObject({status:'unavailable',reports:[]});await expect(source.snapshot(AbortSignal.abort())).rejects.toThrow();
});
