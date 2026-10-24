// @vitest-environment node
import { MeterlessClient, meterlessBaseUrl } from './meterless';

it('normalizes provider URLs without duplicating v1', () => {
  for (const suffix of ['', '/v1', '/v1/models', '/v1/chat/completions', '/healthz']) {
    expect(meterlessBaseUrl(`127.0.0.1:8088${suffix}`)).toBe('http://127.0.0.1:8088/v1');
  }
  expect(() => meterlessBaseUrl('http://user:secret@localhost:8088')).toThrow('credentials');
});

it('distinguishes rejected authentication from an unavailable process', async () => {
  const denied = new MeterlessClient({ baseUrl: 'localhost:8088', token: 'wrong',
    fetch: vi.fn(async () => new Response(null, { status: 401 })) as unknown as typeof fetch });
  expect(await denied.probe()).toEqual({ state: 'unauthorized', httpStatus: 401 });
  const stopped = new MeterlessClient({ baseUrl: 'localhost:8088', token: 'unused',
    fetch: vi.fn(async () => { throw new Error('connection refused'); }) as unknown as typeof fetch });
  expect(await stopped.probe()).toEqual({ state: 'offline', reason: 'network' });
});

it('retains unfamiliar routing modes returned by the real contract', async () => {
  const runtime = new MeterlessClient({ baseUrl: 'localhost:8088', token: 'test',
    fetch: vi.fn(async () => Response.json({ data: [{ id: 'meterless/text.new-mode' }] })) as unknown as typeof fetch });
  expect(await runtime.probe()).toEqual({ state: 'online', models: ['meterless/text.new-mode'] });
});

it('reports the runtime error code without exposing the raw error payload', async () => {
  const runtime = new MeterlessClient({ baseUrl: 'localhost:8088', token: 'test',
    fetch: vi.fn(async () => Response.json({ error: { code: 'no_provider_configured',
      message: 'private provider details' } }, { status: 400 })) as unknown as typeof fetch });
  await expect(runtime.complete('Public smoke prompt')).rejects.toThrow(
    'Meterless completion failed (HTTP 400, no_provider_configured).');
});

it('sends required headers and keeps routing mode separate from actual model evidence', async () => {
  const request = vi.fn(async () => Response.json({ model: 'nvidia/example-nemotron',
    choices: [{ message: { content: 'PORTALONE_OK', reasoning_content: 'not logged' } }] }));
  const runtime = new MeterlessClient({ baseUrl: 'localhost:8088', token: 'test-token', fetch: request as unknown as typeof fetch });
  expect(await runtime.complete('Reply PORTALONE_OK')).toMatchObject({ content: 'PORTALONE_OK',
    requestedMode: 'meterless/auto', responseModel: 'nvidia/example-nemotron' });
  const [url, options] = request.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('http://localhost:8088/v1/chat/completions');
  expect(options.headers).toMatchObject({ Authorization: 'Bearer test-token',
    'meterless-app': 'portal-one', 'meterless-scope': 'user' });
});
