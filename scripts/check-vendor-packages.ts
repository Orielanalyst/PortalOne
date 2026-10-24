import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve('vendor/npm-registry');
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
const lock = readFileSync('bun.lock', 'utf8');
for (const entry of manifest.lockedPackages) {
  if (!/^[a-zA-Z0-9_.-]+\.tgz$/.test(entry.filename)) throw new Error('Unexpected archive filename.');
  if (!lock.includes(entry.integrity)) throw new Error(`Archive is no longer in the lockfile: ${entry.name}`);
  const data = readFileSync(resolve(root, entry.filename));
  if (`sha512-${createHash('sha512').update(data).digest('base64')}` !== entry.integrity ||
    createHash('sha256').update(data).digest('hex') !== entry.sha256) throw new Error(`Archive changed: ${entry.name}`);
  if (entry.licenseTextSource !== 'included in archive') {
    const text = readFileSync(resolve(root, `${entry.filename}.LICENSE`));
    if (createHash('sha256').update(text).digest('hex') !== entry.licenseTextSha256) throw new Error(`License text changed: ${entry.name}`);
  }
}
console.log(`${manifest.lockedPackages.length} vendored registry archives verified locally; no network calls.`);
