import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(readFileSync('vendor/report-wheels/manifest.json','utf8')) as {packages:{file:string;sha256:string;licenseFiles:string[]}[]};
for(const entry of manifest.packages){if(!/^[a-zA-Z0-9_.-]+\.whl$/.test(entry.file) || !entry.licenseFiles.length)throw new Error('Invalid report wheel record.');
  if(createHash('sha256').update(readFileSync(`vendor/report-wheels/${entry.file}`)).digest('hex')!==entry.sha256)throw new Error('Report wheel integrity mismatch.');}
console.log(`${manifest.packages.length} pinned report wheels verified locally; license records present; no network calls.`);
