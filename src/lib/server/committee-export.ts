import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join, relative, sep } from 'node:path';
import { marked } from 'marked';
import type { CommitteeExporter } from './committee-mission';

export const QGIS_IMAGE='qgis/qgis@sha256:bacafbaf899bb2af5d99dd8a138e0438733aac252ddd5f29d089ad34641bb059';
export function reportDirectory(runId: string) {
  if (!/^mission-[a-f0-9-]{36}$/.test(runId)) throw new Error('Invalid report identity.');
  return resolve('.runtime/reports',runId);
}
function run(executable: string,args: string[],signal: AbortSignal,timeout=150_000,env?: NodeJS.ProcessEnv) {
  return new Promise<void>((accept,reject)=>execFile(executable,args,{signal,timeout,maxBuffer:200_000,windowsHide:true,env:env ?? process.env},(error,stdout,stderr)=>{
    if(error){writeFileSync('.runtime/report-engine-error.json',JSON.stringify({engine:executable,stdout:stdout.slice(-12000),stderr:stderr.slice(-12000)},null,2));reject(new Error('Report engine process failed.'));}else accept();
  }));
}
function publicFiles(folder: string,sub=''): {name:string;sha256:string;bytes:number}[] {
  return readdirSync(join(folder,sub)).flatMap(name=>{
    const part=join(sub,name),path=join(folder,part);
    if (statSync(path).isDirectory()) return publicFiles(folder,part);
    if (['input.json','committee-pack.zip'].includes(name)) return [];
    const bytes=readFileSync(path); return [{name:part.split(sep).join('/'),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length}];
  });
}
export const buildCommitteeBundle: CommitteeExporter = async ({dossier,journal,finalDocumentId,signal,progress})=>{
  const root=reportDirectory(dossier.runId);
  if (journal.bundle(dossier.runId)?.status==='ready') throw new Error('Published bundles are immutable.');
  mkdirSync(join(root,'geojson'),{recursive:true}); mkdirSync(join(root,'styles'),{recursive:true}); mkdirSync(join(root,'drafts'),{recursive:true});
  journal.saveBundle({runId:dossier.runId,status:'building',revision:dossier.revision,files:[],note:'Building and validating the committee draft and GIS handoff.',createdAt:new Date().toISOString()});
  try {
    const configuration=existsSync('.runtime/report-runtime.json') ? JSON.parse(readFileSync('.runtime/report-runtime.json','utf8')) : {};
    const python=process.env['REPORT_PYTHON']?.trim() || configuration.python;
    if (typeof python!=='string' || !existsSync(python)) throw new Error('Configure the local report Python runtime.');
    const env={...process.env,PYTHONPATH:resolve('.local-tools/report-python')};
    const documents=journal.documents(dossier.runId).filter(document=>document.runId===dossier.runId && document.status==='published');
    const final=documents.find(document=>document.id===finalDocumentId); if(!final) throw new Error('Final narrative is not published.');
    const citations=journal.citations(dossier.runId);
    writeFileSync(join(root,'input.json'),JSON.stringify({dossier,citations,tokens:marked.lexer(final.markdown)},null,2));
    writeFileSync(join(root,'report.md'),final.markdown); writeFileSync(join(root,'evidence.json'),JSON.stringify(citations,null,2));
    for (const [name,layer] of Object.entries(dossier.layers)) writeFileSync(join(root,'geojson',`${name}.geojson`),JSON.stringify(layer));
    for (const document of documents) writeFileSync(join(root,'drafts',`${document.kind}-v${document.version}-${document.id.slice(-8)}.md`),document.markdown);
    progress('QGIS: writing the GeoPackage and styled project, reopening every layer and checking feature counts, CRS and geometry.');
    await run('docker',['run','--rm','--network','none','--cap-drop','ALL','-e','QT_QPA_PLATFORM=offscreen','-e','HOME=/tmp',
      '--mount',`type=bind,src=${root},dst=/work`,'--mount',`type=bind,src=${resolve('scripts/export-qgis.py')},dst=/tools/export-qgis.py,readonly`,
      '--entrypoint','/usr/bin/python3',QGIS_IMAGE,'/tools/export-qgis.py','/work'],signal);
    const qgis=JSON.parse(readFileSync(join(root,'qgis-validation.json'),'utf8'));
    if (!qgis.projectReopened || qgis.layers.some((layer: {valid:boolean;invalidGeometries:number})=>!layer.valid || layer.invalidGeometries)) throw new Error('Native QGIS validation failed.');
    progress('QGIS validation passed. Rendering the committee PDF with the native map, facility/coordinate inventories and cited evidence register.');
    await run(python,[resolve('scripts/render-committee-pdf.py'),root],signal,120_000,env);
    const pdf=JSON.parse(readFileSync(join(root,'pdf-validation.json'),'utf8')); if(pdf.placeholders || !pdf.mapIncluded) throw new Error('PDF validation failed.');
    writeFileSync(join(root,'README.txt'),`RELIEFINTEL COMMITTEE DRAFT - OPERATIONAL HOLD\nEvidence revision: ${dossier.revision}\nCaptured: ${dossier.capturedAt}\nOpen mission.qgz in QGIS. Source CRS: EPSG:4326; map display: EPSG:32632.\nGeoJSON equivalents and per-layer QML styles are included. Capacity and operating status are unverified.\nEmpty blockage/intervention-zone layers are evidence gaps, not an all-clear. Facility polygon reference points are source boundary vertices, not verified entrances.\n${dossier.attribution} | ODbL 1.0\n`);
    const files=publicFiles(root);
    writeFileSync(join(root,'manifest.json'),JSON.stringify({runId:dossier.runId,revision:dossier.revision,capturedAt:dossier.capturedAt,qgis,files,operationalStatus:'hold',dispatchAuthorized:false},null,2));
    progress('Packing the PDF, map, editable QGIS project, GeoPackage, GeoJSON, source register and versioned drafts with checksums.');
    await run(python,['-c','import json,sys,zipfile,pathlib; r=pathlib.Path(sys.argv[1]); m=json.loads((r/"manifest.json").read_text()); z=zipfile.ZipFile(r/"committee-pack.zip","w",zipfile.ZIP_DEFLATED); [z.write(r/f["name"],f["name"]) for f in m["files"]]; z.write(r/"manifest.json","manifest.json"); z.close()',root],signal,30_000,env);
    const ready=publicFiles(root),zip=readFileSync(join(root,'committee-pack.zip'));
    ready.push({name:'committee-pack.zip',sha256:createHash('sha256').update(zip).digest('hex'),bytes:zip.length});
    journal.saveBundle({runId:dossier.runId,status:'ready',revision:dossier.revision,files:ready,note:'Committee review draft. Native QGIS layers/project reopened successfully; required field and mission confirmations remain open.',createdAt:new Date().toISOString()});
  } catch(error) {
    journal.saveBundle({runId:dossier.runId,status:'failed',revision:dossier.revision,files:[],note:'Report export did not complete. Inspect the visible failed step; no final pack has been published.',createdAt:new Date().toISOString()});
    throw error;
  }
};
export function readBundleFile(runId: string,name: string,expectedHash: string) {
  const root=reportDirectory(runId),path=resolve(root,name),from=relative(root,path);
  if (!from || from.startsWith('..') || from.includes(':')) throw new Error('Invalid bundle path.');
  const bytes=readFileSync(path); if(createHash('sha256').update(bytes).digest('hex')!==expectedHash) throw new Error('Bundle integrity mismatch.'); return bytes;
}
