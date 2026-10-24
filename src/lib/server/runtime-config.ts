import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MeterlessClient } from './meterless';

export function configuredNightshift() {
  const path = process.env['LOCALAPPDATA'] ? join(process.env['LOCALAPPDATA'], 'ai.meterless.runtime', 'proxy-token') : '';
  const token = process.env['METERLESS_RUNTIME_TOKEN'] || (path && existsSync(path) ? readFileSync(path, 'utf8').trim() : '');
  if (!token) throw new Error('Nightshift runtime token is missing. Configure it locally, never in a prompt.');
  return new MeterlessClient({ baseUrl: process.env['METERLESS_BASE_URL'] ?? 'http://127.0.0.1:8088/v1', token });
}
