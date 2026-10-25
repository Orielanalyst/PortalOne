/** Publish a layout edition from an immutable completed run; no model/source calls. */
import {execFileSync} from 'node:child_process';
import {copyFileSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {MissionJournal} from '../src/lib/server/mission-journal';
import {reportDirectory} from '../src/lib/server/committee-export';
const runId=process.argv.find(arg=>arg.startsWith('--run='))?.slice(6) ?? '';
const edition=Number(process.argv.find(arg=>arg.startsWith('--edition='))?.slice(10));
if(!Number.isInteger(edition)||edition<2||edition>99)throw new Error('Specify --run=mission-UUID --edition=2 (or a later edition).');
const original=reportDirectory(runId),target=resolve('.runtime/report-editions',runId,`edition-${edition}`);
if(existsSync(target))throw new Error('Layout editions are immutable; select a new edition number.');
const journal=new MissionJournal(resolve('.runtime/mission/journal.sqlite'));
try {
 const previous=journal.bundle(runId);if(previous?.status!=='ready')throw new Error('A completed, validated original bundle is required.');
 const manifest=JSON.parse(readFileSync(join(original,'manifest.json'),'utf8'));
 mkdirSync(target,{recursive:true});
 for(const file of manifest.files){const source=join(original,file.name);if(createHash('sha256').update(readFileSync(source)).digest('hex')!==file.sha256)throw new Error('Original bundle integrity mismatch.');const destination=join(target,file.name);mkdirSync(dirname(destination),{recursive:true});copyFileSync(source,destination);}
 copyFileSync(join(original,'input.json'),join(target,'input.json'));
 const configuration=JSON.parse(readFileSync('.runtime/report-runtime.json','utf8'));
 const python=process.env['REPORT_PYTHON']?.trim() || configuration.python;
 execFileSync(python,[resolve('scripts/render-committee-pdf.py'),target],{timeout:120000,windowsHide:true,env:{...process.env,PYTHONPATH:resolve('.local-tools/report-python')}});
 const files=manifest.files.map((file:{name:string})=>{const bytes=readFileSync(join(target,file.name));return {name:file.name,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};});
 const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
 const validation={edition,sourceRunId:runId,sourceCommit,narrativeChanged:false,geodataChanged:false,originalPdfSha256:previous.files.find(file=>file.name==='report.pdf')?.sha256,pdf:JSON.parse(readFileSync(join(target,'pdf-validation.json'),'utf8'))};
 writeFileSync(join(target,'manifest.json'),JSON.stringify({...manifest,files,layoutEdition:validation},null,2));
 execFileSync(python,['-c','import json,sys,zipfile,pathlib; r=pathlib.Path(sys.argv[1]); m=json.loads((r/"manifest.json").read_text()); z=zipfile.ZipFile(r/"committee-pack.zip","w",zipfile.ZIP_DEFLATED); [z.write(r/f["name"],f["name"]) for f in m["files"]]; z.write(r/"manifest.json","manifest.json"); z.close()',target],{timeout:30000,windowsHide:true});
 const additions=[['report.pdf',`report-edition-${edition}.pdf`],['committee-pack.zip',`committee-pack-edition-${edition}.zip`],['manifest.json',`manifest-edition-${edition}.json`],['pdf-validation.json',`pdf-edition-${edition}-validation.json`]].map(([from,name])=>{
   const destination=join(original,name!);if(existsSync(destination))throw new Error('Refusing to overwrite a published edition.');copyFileSync(join(target,from!),destination);const bytes=readFileSync(destination);return {name:name!,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
 });
 journal.saveBundle({...previous,files:[...previous.files,...additions],note:`Committee review draft · PDF layout edition ${edition}. Original exports are retained. Native QGIS layers/project validated; field confirmations remain open.`});
 journal.event(runId,'reporter','report_edition_ready',`Report preparation published PDF layout edition ${edition}: readable action blocks and complete inventory/source entries. The generated narrative and geodata are unchanged.`,[]);
 console.log(JSON.stringify({runId,...validation,files:additions},null,2));
}finally{journal.close();}
