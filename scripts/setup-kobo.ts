import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const token = process.env['KOBO_API_TOKEN']?.trim();
const server = new URL(process.env['KOBO_SERVER_URL'] || 'https://kf.kobotoolbox.org');
if (!token) throw new Error('Configure KOBO_API_TOKEN locally; never paste it in chat.');
if (server.protocol !== 'https:' || !['kf.kobotoolbox.org', 'eu.kobotoolbox.org'].includes(server.hostname) || server.username || server.password || server.port || server.search || server.hash) throw new Error('Use an official Kobo HTTPS server.');
const name = 'ReliefIntel — Field Observation';
const marker = 'portal-one-managed-relief-field-v1';
const form = JSON.parse(readFileSync('data/kobo/relief-field-report-v1.json', 'utf8'));
// Kobo's content API needs explicit translation arrays when default_language is set.
for (const row of [...form.survey, ...form.choices]) for (const key of ['label', 'hint', 'constraint_message']) {
  if (typeof row[key] === 'string') row[key] = [row[key]];
}
form.translations = ['English']; form.translated = ['label', 'hint', 'constraint_message'];
const content = JSON.stringify(form);
async function api(path: string, method = 'GET', data?: unknown) {
  const response = await fetch(`${server.origin}/api/v2/${path}`, { method,
    headers: { Authorization: `Token ${token}`, Accept: 'application/json', ...(data ? { 'Content-Type': 'application/json' } : {}) },
    body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(30_000) });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Kobo ${method} failed (HTTP ${response.status}); no response content logged.`);
  return result;
}
const listing = await api(`assets/?q=${encodeURIComponent('name__icontains:ReliefIntel')}&limit=10`);
const matches = listing.results.filter((item: any) => item.settings?.description?.includes(marker));
const configuredUid = process.env['KOBO_PROJECT_UID']?.trim();
if (matches.length > 1 && !matches.some((item: any) => item.uid === configuredUid)) throw new Error('Multiple managed projects found; resolve the exact UID locally.');
let asset = matches.find((item: any) => item.uid === configuredUid) ?? matches[0];
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ operation: asset ? 'Reuse managed project' : 'Create private draft project', name,
    formHash: createHash('sha256').update(content).digest('hex'), existingProject: asset?.uid ?? null,
    deployRequested: process.argv.includes('--deploy') }, null, 2));
  process.exit(0);
}
if (!asset) asset = await api('assets/', 'POST', { name, asset_type: 'survey',
  settings: { description: `${marker}: humanitarian report intake; demonstration records labelled explicitly.`, country: 'CMR', 'share-metadata': false } });
if (!/^[a-zA-Z0-9]+$/.test(asset.uid)) throw new Error('Unexpected project UID.');
if (!asset.deployment__active) asset = await api(`assets/${asset.uid}/`, 'PATCH', { content });
const validation = await api(`assets/${asset.uid}/valid_content/`);
mkdirSync('.runtime/kobo', { recursive: true });
writeFileSync('.runtime/kobo/form-validation.json', JSON.stringify(validation, null, 2) + '\n');
if (!Array.isArray(validation.data?.survey) || validation.data.translations?.length !== 1 ||
    validation.data.survey.some((row: any) => !row.label?.[0])) throw new Error('Kobo form normalization failed; inspect the local validation receipt.');
if (process.argv.includes('--deploy') && !asset.deployment__active) await api(`assets/${asset.uid}/deployment/`, 'POST', { active: true });
const updated = await api(`assets/${asset.uid}/`);
const env = readFileSync('.env', 'utf8');
writeFileSync('.env', env.replace(/^KOBO_PROJECT_UID=.*$/m, `KOBO_PROJECT_UID=${asset.uid}`));
const receipt = { capturedAt: new Date().toISOString(), server: server.origin, projectUid: asset.uid,
  name, projectUrl: `${server.origin}/#/forms/${asset.uid}/summary`, deployed: updated.deployment__active === true,
  formSha256: createHash('sha256').update(content).digest('hex'),
  questions: JSON.parse(content).survey.length, submissionCount: updated.deployment__submission_count ?? 0,
  note: 'Project setup is not proof of received field observations. No messages sent to third parties.' };
writeFileSync(resolve('.runtime/kobo/project.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
