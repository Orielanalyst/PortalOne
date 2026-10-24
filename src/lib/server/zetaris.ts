import { randomUUID } from 'node:crypto';

type ZetarisOptions = { baseUrl: string; orgId: string; username?: string; password?: string;
  token?: string; fetch?: typeof fetch; timeoutMs?: number };
export type ZetarisResult = { headers: string[]; data: unknown[][]; total: number; timeUsed?: number };

/** Internal server/CLI client. Application tools use fixed SELECT templates. */
export class ZetarisClient {
  private token: string | undefined;
  private readonly request: typeof fetch;
  private readonly origin: string;
  constructor(private readonly options: ZetarisOptions) {
    const url = new URL(options.baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/') throw new Error('Use a Zetaris HTTP origin.');
    if (!/^\d+$/.test(options.orgId)) throw new Error('A numeric Zetaris org ID is required.');
    this.origin = url.origin;
    this.request = options.fetch ?? fetch;
    this.token = options.token;
  }
  private async call(path: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
    const timeout = AbortSignal.timeout(this.options.timeoutMs ?? 30_000);
    const abort = signal ? AbortSignal.any([timeout, signal]) : timeout;
    if (!this.token) {
      if (!this.options.username || !this.options.password) throw new Error('Zetaris credentials are missing.');
      const login = await this.request(`${this.origin}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-ID': randomUUID() },
        body: JSON.stringify({ username: this.options.username, password: this.options.password }), signal: abort,
      });
      if (!login.ok) throw new Error(`Zetaris login failed (HTTP ${login.status}).`);
      const payload = await login.json() as Record<string, unknown>;
      const token = payload['idToken'] ?? payload['token'] ?? payload['accessToken'];
      if (typeof token !== 'string' || !token) throw new Error('Zetaris login returned no token.');
      this.token = token;
    }
    const response = await this.request(`${this.origin}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'X-Org-ID': this.options.orgId,
        'X-Request-ID': randomUUID(), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: abort,
    });
    if (!response.ok) throw new Error(`Zetaris request failed (HTTP ${response.status}).`);
    return response.json();
  }
  async query(sql: string, signal?: AbortSignal): Promise<ZetarisResult> {
    if (!/^\s*SELECT\b/i.test(sql) || sql.includes(';')) throw new Error('One bounded SELECT is required.');
    const result = await this.command(sql, signal);
    if (!Array.isArray(result.headers) || !result.headers.every(item => typeof item === 'string') ||
      !Array.isArray(result.data) || !result.data.every(row => Array.isArray(row) && row.length === result.headers.length) ||
      !Number.isFinite(Number(result.total)) || Number(result.total) < 0) throw new Error('Unexpected Zetaris table response.');
    // A full page may hide a fifty-first origin. Fail closed at the boundary.
    if (result.data.length >= 50 || Number(result.total) >= 50) throw new Error('Zetaris row budget reached; narrow the query.');
    return result;
  }
  /** Provisioning only; never offered to the planner. No SQL/error bodies logged. */
  async command(sql: string, signal?: AbortSignal): Promise<ZetarisResult> {
    return await this.call('/api/proxy/sql-editor/sqls/run-query', { sql, limit: 50 }, signal) as ZetarisResult;
  }
}

export function configuredZetaris(): ZetarisClient {
  return new ZetarisClient({ baseUrl: process.env['ZETARIS_BASE_URL'] ?? 'http://127.0.0.1:3000',
    orgId: process.env['ZETARIS_ORG_ID'] ?? '', token: process.env['ZETARIS_API_KEY'],
    username: process.env['ZETARIS_USERNAME'], password: process.env['ZETARIS_PASSWORD'] });
}
