export type RuntimeProbe =
  | { state: 'online'; models: string[] }
  | { state: 'unauthorized'; httpStatus: number }
  | { state: 'offline'; reason: 'network' | 'unexpected_response'; httpStatus?: number };

export function meterlessBaseUrl(input: string): string {
  const url = new URL(input.includes('://') ? input : `http://${input}`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.search) {
    throw new Error('Use the Meterless HTTP origin or API URL without embedded credentials.');
  }
  return `${url.origin}/v1`;
}

/** Server-side adapter for the published Meterless OpenAI-compatible contract. */
export class MeterlessClient {
  readonly baseUrl: string;
  private readonly request: typeof fetch;
  private readonly token: string;
  private readonly app: string;

  constructor(options: { baseUrl: string; token: string; app?: string; fetch?: typeof fetch }) {
    this.baseUrl = meterlessBaseUrl(options.baseUrl);
    this.token = options.token;
    this.app = options.app ?? 'portal-one';
    this.request = options.fetch ?? fetch;
  }

  private headers(chat = false): Record<string, string> {
    return { Authorization: `Bearer ${this.token}`, 'meterless-app': this.app,
      ...(chat ? { 'meterless-scope': 'user', 'Content-Type': 'application/json' } : {}) };
  }

  async probe(timeoutMs = 2_000): Promise<RuntimeProbe> {
    try {
      const response = await this.request(`${this.baseUrl}/models`, {
        headers: this.headers(), signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status === 401 || response.status === 403) {
        return { state: 'unauthorized', httpStatus: response.status };
      }
      if (!response.ok) return { state: 'offline', reason: 'unexpected_response', httpStatus: response.status };
      const body = await response.json() as { data?: { id?: unknown }[] };
      if (!Array.isArray(body.data)) return { state: 'offline', reason: 'unexpected_response' };
      const models = body.data.flatMap(item => typeof item.id === 'string' && item.id.startsWith('meterless/')
        ? [item.id] : []);
      return models.length ? { state: 'online', models } : { state: 'offline', reason: 'unexpected_response' };
    } catch {
      return { state: 'offline', reason: 'network' };
    }
  }

  async complete(prompt: string, model = 'meterless/auto', timeoutMs = 180_000, options: { signal?: AbortSignal } = {}) {
    if (!model.startsWith('meterless/')) throw new Error('Choose a routing mode returned by Meterless.');
    const started = performance.now();
    const timeout = Math.max(1, Math.floor(timeoutMs));
    const response = await this.request(`${this.baseUrl}/chat/completions`, {
      method: 'POST', headers: this.headers(true), signal: options.signal
        ? AbortSignal.any([AbortSignal.timeout(timeout), options.signal]) : AbortSignal.timeout(timeout),
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }],
        max_tokens: 128, temperature: 0, stream: false,
        chat_template_kwargs: { enable_thinking: false } }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null) as { error?: { code?: unknown } } | null;
      const rawCode = error?.error?.code;
      const code = typeof rawCode === 'string' && /^[a-z0-9_]{1,64}$/.test(rawCode) ? `, ${rawCode}` : '';
      throw new Error(`Meterless completion failed (HTTP ${response.status}${code}).`);
    }
    const body = await response.json() as {
      model?: unknown;
      choices?: { finish_reason?: string; message?: { content?: unknown } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const choice = body.choices?.[0];
    if (choice?.finish_reason === 'length') throw new Error('Meterless answer exceeded its token budget.');
    const raw = choice?.message?.content;
    if (typeof raw !== 'string') throw new Error('Meterless returned no plain-text answer.');
    // Some Nemotron responses put the thinking prefix in content, with only a
    // closing delimiter. Never return that prefix or an unfinished trace.
    const end = raw.lastIndexOf('</think>');
    const content = (end >= 0 ? raw.slice(end + '</think>'.length) : raw).trim();
    if (!content || content.includes('<think>')) throw new Error('Meterless returned no plain-text answer.');
    return { content, requestedMode: model,
      reasoningRequested: false,
      responseModel: typeof body.model === 'string' ? body.model : null,
      providerHeader: response.headers.get('x-meterless-provider'),
      modelHeader: response.headers.get('x-meterless-model'),
      usage: body.usage, durationMs: Math.round(performance.now() - started) };
  }
}
