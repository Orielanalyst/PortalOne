import { createParser } from 'eventsource-parser';
export type StreamAnswer = { content: string; requestedMode: string; responseModel: string | null;
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
  durationMs: number; firstDeltaMs: number | null; deltas: number };

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

  async complete(prompt: string, model = 'meterless/auto', timeoutMs = 180_000, options: { signal?: AbortSignal; maxTokens?: number } = {}) {
    if (!model.startsWith('meterless/')) throw new Error('Choose a routing mode returned by Meterless.');
    const maxTokens = options.maxTokens ?? 128;
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 4096) throw new Error('Invalid completion token budget.');
    const started = performance.now();
    const timeout = Math.max(1, Math.floor(timeoutMs));
    const response = await this.request(`${this.baseUrl}/chat/completions`, {
      method: 'POST', headers: this.headers(true), signal: options.signal
        ? AbortSignal.any([AbortSignal.timeout(timeout), options.signal]) : AbortSignal.timeout(timeout),
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens, temperature: 0, stream: false,
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
  /** Native provider SSE; reasoning fields are never forwarded. */
  async stream(prompt: string, model: string, options: { signal?: AbortSignal; maxTokens?: number; timeoutMs?: number; onDelta: (text: string) => void }): Promise<StreamAnswer> {
    const maxTokens = options.maxTokens ?? 1024;
    if (!model.startsWith('meterless/') || !Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 4096) throw new Error('Invalid streaming request.');
    const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeoutMs ?? 90_000)]) : AbortSignal.timeout(options.timeoutMs ?? 90_000);
    const started = performance.now();
    const response = await this.request(`${this.baseUrl}/chat/completions`, { method: 'POST', headers: this.headers(true), signal,
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0,
        stream: true, stream_options: { include_usage: true }, chat_template_kwargs: { enable_thinking: false } }) });
    if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('Provider streaming is unavailable.');
    let content = '', pending = '', done = false, finish: string | null = null, responseModel: string | null = null;
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
    let deltas = 0, firstDeltaMs: number | null = null;
    const emit = (text: string) => {
      if (!text) return;
      content += text; if (content.length > 100_000) throw new Error('Stream exceeded its size budget.');
      firstDeltaMs ??= Math.round(performance.now() - started); deltas++; options.onDelta(text);
    };
    const parser = createParser({ maxBufferSize: 256_000, onEvent(event) {
      signal.throwIfAborted();
      if (event.data === '[DONE]') { done = true; return; }
      const value = JSON.parse(event.data);
      if (value.error) throw new Error('Provider stream failed.');
      if (typeof value.model === 'string') responseModel = value.model;
      if (value.usage) usage = value.usage;
      const choice = value.choices?.[0];
      if (choice?.finish_reason) finish = choice.finish_reason;
      const delta = choice?.delta?.content;
      if (typeof delta !== 'string') return;
      pending += delta;
      if (/<\/?think\b/i.test(pending)) throw new Error('Provider included a private reasoning delimiter.');
      if (pending.length > 9) { emit(pending.slice(0, -9)); pending = pending.slice(-9); }
    }, onError(error) { if (error.type === 'max-buffer-size-exceeded') throw new Error('Malformed provider stream.'); } });
    const reader = response.body.getReader(), decoder = new TextDecoder();
    try {
      while (true) { signal.throwIfAborted(); const chunk = await reader.read(); if (chunk.done) break; parser.feed(decoder.decode(chunk.value, { stream: true })); }
      parser.feed(decoder.decode());
      if (!done || finish !== 'stop') throw new Error('Provider stream did not finish successfully.');
      emit(pending); if (!content.trim()) throw new Error('Provider returned an empty stream.');
      return { content, requestedMode: model, responseModel, usage, durationMs: Math.round(performance.now() - started), firstDeltaMs, deltas };
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
}
