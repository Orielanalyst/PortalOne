// @vitest-environment node
import { ZetarisClient } from './zetaris';
import { reliefQueries, readScenario } from './relief-source';

it('authenticates without returning credentials and sends org/request headers', async () => {
  const request = vi.fn(async (url: string, _options?: RequestInit) => url.endsWith('/api/auth/login')
    ? Response.json({ idToken: 'test-only-token' }) : Response.json({ headers: ['n'], data: [['1']], total: 1 }));
  const client = new ZetarisClient({ baseUrl: 'http://localhost:3000', orgId: '1', username: 'test', password: 'test', fetch: request as unknown as typeof fetch });
  expect((await client.query('SELECT 1 AS n')).data).toEqual([['1']]);
  const options = request.mock.calls[1]![1] as unknown as RequestInit;
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
  for (const payload of [{ headers: ['n'], data: [['1']], total: 51 }, { headers: ['n'], data: [[]], total: 1 }]) {
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
