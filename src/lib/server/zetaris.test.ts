// @vitest-environment node
import { ZetarisClient } from './zetaris';
import { reliefQueries, readScenario } from './relief-source';
it('renews an expired generated session once for the same account, without retrying commands or supplied API keys',async()=>{
  let logins=0,reads=0;const progress=vi.fn();
  const request=vi.fn(async(url:string)=>url.endsWith('/api/auth/login')?Response.json({idToken:'test-session-'+(++logins)}):++reads===1?new Response('',{status:401}):Response.json({headers:['n'],data:[[1]],total:1}));
  const client=new ZetarisClient({baseUrl:'http://localhost:3000',orgId:'1',username:'test',password:'test',fetch:request as unknown as typeof fetch});
  expect((await client.query('SELECT 1 AS n',undefined,progress)).data).toEqual([[1]]);expect(logins).toBe(2);expect(progress).toHaveBeenCalledOnce();
  const rejected=vi.fn<typeof fetch>().mockImplementation(async()=>new Response('',{status:401}));
  await expect(new ZetarisClient({baseUrl:'http://localhost:3000',orgId:'1',token:'supplied-key',fetch:rejected}).query('SELECT 1')).rejects.toThrow('HTTP 401');expect(rejected).toHaveBeenCalledTimes(1);
  const unavailable=vi.fn<typeof fetch>().mockImplementation(async()=>new Response('',{status:503}));
  await expect(new ZetarisClient({baseUrl:'http://localhost:3000',orgId:'1',token:'test',fetch:unavailable}).command('CREATE DATASOURCE example')).rejects.toThrow('HTTP 503');expect(unavailable).toHaveBeenCalledTimes(1);
});
it('retries a transient bounded SELECT but never retries a malformed successful table',async()=>{
  const request=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('',{status:503})).mockResolvedValueOnce(Response.json({headers:['n'],data:[[1]],total:1}));const progress=vi.fn();
  const client=new ZetarisClient({baseUrl:'http://localhost:3000',orgId:'1',token:'test',fetch:request});
  expect((await client.query('SELECT 1',undefined,progress)).data).toEqual([[1]]);expect(request).toHaveBeenCalledTimes(2);expect(progress).toHaveBeenCalledOnce();
  const invalid=vi.fn<typeof fetch>().mockImplementation(async()=>Response.json({headers:['n'],data:[[]],total:1}));
  await expect(new ZetarisClient({baseUrl:'http://localhost:3000',orgId:'1',token:'test',fetch:invalid}).query('SELECT 1')).rejects.toThrow('Unexpected');expect(invalid).toHaveBeenCalledTimes(1);
});

it('authenticates without returning credentials and sends org/request headers', async () => {
  const request = vi.fn(async (url: string, _options?: RequestInit) => url.endsWith('/api/auth/login')
    ? Response.json({ idToken: 'test-only-token' }) : Response.json({ headers: ['n'], data: [['1']], total: 1 }));
  const client = new ZetarisClient({ baseUrl: 'http://localhost:3000', orgId: '1', username: 'test', password: 'test', fetch: request as unknown as typeof fetch });
  expect((await client.query('SELECT 1 AS n')).data).toEqual([['1']]);
  const options = request.mock.calls[1]![1] as unknown as RequestInit;
  expect(options.signal).not.toBe((request.mock.calls[0]![1] as RequestInit).signal);
  expect(options.headers).toMatchObject({ Authorization: 'Bearer test-only-token', 'X-Org-ID': '1' });
  expect((options.headers as Record<string, string>)['X-Request-ID']).toMatch(/^[0-9a-f-]{36}$/);
});

it('rejects writes and multiple statements on the application read path', async () => {
  const request = vi.fn();
  const client = new ZetarisClient({ baseUrl: 'http://localhost:3000', orgId: '1', token: 'test', fetch: request });
  await expect(client.query('DROP TABLE test')).rejects.toThrow('SELECT');
  await expect(client.query('SELECT 1; SELECT 2')).rejects.toThrow('SELECT');
  expect(request).not.toHaveBeenCalled();
});

it('fails rather than silently using truncated or malformed tables', async () => {
  for (const payload of [{ headers: ['n'], data: [['1']], total: 51 },
    { headers: ['n'], data: Array.from({ length: 50 }, () => ['1']), total: 50 },
    { headers: ['n'], data: [[]], total: 1 }]) {
    const client = new ZetarisClient({ baseUrl: 'http://localhost:3000', orgId: '1', token: 'test',
      fetch: vi.fn(async () => Response.json(payload)) as unknown as typeof fetch });
    await expect(client.query('SELECT 1 AS n')).rejects.toThrow();
  }
});

it('compares event timestamps as timestamps and scopes queries to validated fixture IDs', () => {
  const pack = readScenario();
  const queries = reliefQueries(pack.mission, pack.changedAt);
  expect(queries[1]!.sql).toContain('CAST(observed_at AS TIMESTAMP)');
  expect(queries[0]!.sql).toContain('PORTALONE_LOGISTICS_V1');
  expect(queries[0]!.sql).toContain('PORTALONE_SCENARIO_V1');
  expect(() => reliefQueries({ ...pack.mission, depotId: "'; DROP TABLE x" }, pack.clock)).toThrow();
});
