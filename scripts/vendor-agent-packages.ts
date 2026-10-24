import ts from 'typescript';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

// Acquisition receipt against the last pushed pre-orchestration lockfile.
const baseline = Bun.spawnSync(['git', 'show', '341de32:bun.lock'], { stdout: 'pipe' });
if (baseline.exitCode !== 0) throw new Error('Expected acquisition baseline 341de32.');
const parse = (text: string) => ts.parseConfigFileTextToJson('bun.lock', text).config;
const before = parse(baseline.stdout.toString());
const after = parse(readFileSync('bun.lock', 'utf8'));
const folder = resolve('vendor/npm-registry');
mkdirSync(folder, { recursive: true });
let previous: any[] = [];
try { previous = JSON.parse(readFileSync(resolve(folder, 'manifest.json'), 'utf8')).lockedPackages; } catch { /* first acquisition */ }
const acquired = [];
for (const [key, entry] of Object.entries(after.packages) as [string, any[]][]) {
  if (JSON.stringify(before.packages[key]) === JSON.stringify(entry) && key !== 'zod') continue;
  const [name, version] = String(entry[0]).split(/@(?=[^@]+$)/);
  if (!name || !version) throw new Error('Unexpected locked package identity.');
  const integrity = entry.find(value => typeof value === 'string' && value.startsWith('sha512-'));
  if (!integrity) throw new Error(`No locked integrity for ${name}.`);
  const cached = previous.find(p => p.name === name && p.version === version && p.integrity === integrity);
  if (cached) {
    const bytes = readFileSync(resolve(folder, cached.filename));
    if (`sha512-${createHash('sha512').update(bytes).digest('base64')}` !== integrity) throw new Error(`Cached archive integrity mismatch: ${name}`);
    if (cached.licenseTextSource !== 'included in archive') {
      const license = readFileSync(resolve(folder, `${cached.filename}.LICENSE`));
      cached.licenseTextSha256 = createHash('sha256').update(license).digest('hex');
    }
    acquired.push(cached);
    continue;
  }
  const metadataResponse = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`);
  if (!metadataResponse.ok) throw new Error(`Registry metadata unavailable for ${name}.`);
  const metadata = await metadataResponse.json() as any;
  if (!['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD'].includes(metadata.license)) {
    throw new Error(`Review the declared license for ${name} before adoption.`);
  }
  const tarball = new URL(metadata.dist.tarball);
  if (tarball.hostname !== 'registry.npmjs.org' || tarball.protocol !== 'https:') throw new Error('Unexpected registry archive host.');
  const response = await fetch(tarball);
  if (!response.ok) throw new Error(`Registry archive unavailable for ${name}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
  if (actual !== integrity || actual !== metadata.dist.integrity) throw new Error(`Integrity mismatch for ${name}.`);
  const filename = `${name.replace('@', '').replaceAll('/', '-')}-${version}.tgz`;
  writeFileSync(resolve(folder, filename), bytes);
  const listing = Bun.spawnSync(['tar', '-tzf', resolve(folder, filename)], { stdout: 'pipe', stderr: 'pipe' });
  if (listing.exitCode !== 0) throw new Error(`Archive listing failed for ${name}.`);
  let licenseTextSource = 'included in archive';
  if (!/(^|\/)(licen[cs]e|copying)([-_.][^/\n]*)?(\n|$)/im.test(listing.stdout.toString().replaceAll('\r', ''))) {
    const repository = typeof metadata.repository === 'string' ? metadata.repository : metadata.repository?.url;
    const repo = String(repository).match(/github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?$/)?.[1];
    if (!repo || !/^[a-f0-9]{40}$/.test(metadata.gitHead)) throw new Error(`No pinned upstream license location for ${name}.`);
    let licenseText = '';
    for (const basename of ['LICENSE', 'LICENSE.md', 'LICENSE.txt']) {
      const url = `https://raw.githubusercontent.com/${repo}/${metadata.gitHead}/${basename}`;
      const licenseResponse = await fetch(url);
      if (licenseResponse.ok) { licenseText = await licenseResponse.text(); licenseTextSource = url; break; }
    }
    if (!licenseText || (metadata.license === 'MIT' && !licenseText.includes('Permission is hereby granted'))) {
      throw new Error(`Pinned license text not confirmed for ${name}.`);
    }
    writeFileSync(resolve(folder, `${filename}.LICENSE`), licenseText);
  }
  acquired.push({ name, version, license: metadata.license, filename, integrity, tarball: tarball.href,
    sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, licenseTextSource });
}
writeFileSync(resolve(folder, 'manifest.json'), JSON.stringify({ acquiredAt: new Date().toISOString(),
  baselineCommit: '341de32', lockedPackages: acquired }, null, 2) + '\n');
console.log(JSON.stringify({ packages: acquired.length, bytes: acquired.reduce((sum, p) => sum + p.bytes, 0),
  licenses: [...new Set(acquired.map(p => p.license))], lockedIntegritiesVerified: true, licenseFilesPresent: true }, null, 2));
