import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {configuredZetaris,type ZetarisResult} from '../src/lib/server/zetaris';

// Reuses the application's authenticated, bounded Zetaris client. Provisioning
// commands stay in this operator CLI and are never exposed as model tools.
const config=JSON.parse(readFileSync('data/zetaris-usl-v1/queries.json','utf8')) as {
  namespace:string;usl:string;scope:string;
  exploration:{id:string;source:string;sql:string}[];
  activations:{table:string;sql:string}[];
  verification:{id:string;sql:string}[];
  quality:{id:string;table:string;expression:string}[];
};
const ddl=readFileSync('data/zetaris-usl-v1/model.sql','utf8');
const model=`${config.namespace}.${config.usl}`;
if(!process.argv.includes('--apply')){
  console.log(JSON.stringify({model,scope:config.scope,operation:'Create the project-owned namespace/model if absent; activate its four tables; run six exploratory reads, three USL reads and two DQ rules. No source records are modified.',run:'bun scripts/check-zetaris-usl.ts --apply'},null,2));
  process.exit(0);
}
const client=configuredZetaris(),startedAt=new Date().toISOString();
const receipts:{id:string;sql:string;result:ZetarisResult}[]=[];
async function command(id:string,sql:string){
  const result=await client.command(sql);
  if(!Array.isArray(result.headers)||!Array.isArray(result.data))throw new Error(`Invalid Zetaris table response for ${id}.`);
  receipts.push({id,sql,result});console.log(`${id}: ${result.data.length} result rows`);return result;
}
for(const item of config.exploration)await command(item.id,item.sql);
await command('metastore-parent','CREATE NAMESPACE IF NOT EXISTS lightning.metastore');
await command('namespace',`CREATE NAMESPACE IF NOT EXISTS ${config.namespace}`);
const existing=await command('namespace-catalog',`SHOW NAMESPACES OR TABLES IN ${config.namespace}`);
if(!existing.data.some(row=>row.some(value=>String(value)===config.usl)))await command('compile-deploy',ddl);
// Never UPDATE/REMOVE an existing model. Activation validates the checked-in schema.
for(const item of config.activations)await command(`activate-${item.table}`,`ACTIVATE USL TABLE ${model}.${item.table} AS ${item.sql}`);
const active=await command('active-tables',`SHOW NAMESPACES OR TABLES IN ${model}`);
assert.equal(active.data.length,4,'Expected four USL tables.');
assert.ok(active.data.every(row=>String(row[active.headers.indexOf('activated')])==='true'),'Every USL table must be active.');
await command('model-definition',`LOAD USL ${config.usl} NAMESPACE ${config.namespace}`);
for(const item of config.verification)await command(item.id,item.sql);
const rules=await command('quality-catalog',`LIST DQ USL ${model}`);
for(const rule of config.quality){
  if(!rules.data.some(row=>row.some(value=>String(value)===rule.id)))await command(`register-${rule.id}`,`REGISTER DQ ${rule.id} TABLE ${model}.${rule.table} AS ${rule.expression}`);
  const dq=await command(`run-${rule.id}`,`RUN DQ ${rule.id} TABLE ${model}.${rule.table}`);
  assert.equal(dq.data.length,1,'A DQ execution receipt is required.');
  const total=Number(dq.data[0]![dq.headers.indexOf('total_record')]),invalid=Number(dq.data[0]![dq.headers.indexOf('invalid_record')]);
  assert.ok(total>0&&Number.isFinite(invalid),'DQ must evaluate actual records.');
  assert.equal(invalid,rule.id==='current_access_evidence'?total:0,'Quality outcome differs from this labelled rehearsal contract.');
}
const receipt={schemaVersion:1,startedAt,finishedAt:new Date().toISOString(),scope:config.scope,
  model,ddlSha256:createHash('sha256').update(ddl).digest('hex'),
  privacy:'Only public OSM reference rows and checked-in synthetic logistics/access fixtures. No community reports, identities, narratives, credentials or private batch metadata.',
  applicationBoundary:'The live application still uses its fixed source-level SELECT templates. This activated USL is a separately verified semantic contract; no claim that the live adapter has been migrated.',
  receipts};
mkdirSync('.runtime/usl',{recursive:true});
writeFileSync('.runtime/usl/verified.json',JSON.stringify(receipt,null,2)+'\n');
console.log('Saved .runtime/usl/verified.json. Inspect before publication.');
