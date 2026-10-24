import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { MeterlessClient } from '../src/lib/server/meterless';

const tokenPath = process.env['LOCALAPPDATA']
  ? join(process.env['LOCALAPPDATA'], 'ai.meterless.runtime', 'proxy-token') : '';
const token = process.env['METERLESS_RUNTIME_TOKEN'] || (tokenPath && existsSync(tokenPath)
  ? readFileSync(tokenPath, 'utf8').trim() : '');
const candidates = [...new Set([process.env['METERLESS_BASE_URL'],
  ...[8088, 8090, 8787, 11434].map(port => `http://127.0.0.1:${port}/v1`)].filter(Boolean))] as string[];
const checks = [];
let selected: MeterlessClient | undefined;
for (const baseUrl of candidates) {
  const client = new MeterlessClient({ baseUrl, token });
  const result = await client.probe();
  checks.push({ baseUrl: client.baseUrl, ...result });
  if (result.state !== 'offline') { selected = client; break; }
}
const receipt: Record<string, unknown> = { captured_at_utc: new Date().toISOString(),
  tokenAvailable: Boolean(token), checks, inferenceAttempted: false };
if (selected && process.argv.includes('--infer')) {
  receipt['inferenceAttempted'] = true;
  try {
    const wrongTokenClient = new MeterlessClient({ baseUrl: selected.baseUrl, token: 'portal-one-invalid-token' });
    receipt['wrongTokenProbe'] = await wrongTokenClient.probe();
    receipt['completion'] = await selected.complete('Reply with exactly PORTALONE_OK.');
  } catch (error) { receipt['inferenceError'] = error instanceof Error ? error.message : 'Completion failed.'; }
}
if (process.argv.includes('--evidence')) {
  writeFileSync(resolve('docs/evidence/meterless-2026-10-24.json'), JSON.stringify(receipt, null, 2) + '\n');
}
console.log(JSON.stringify(receipt, null, 2));
process.exit(checks.some(check => check.state === 'online') && !receipt['inferenceError'] ? 0 : 1);
