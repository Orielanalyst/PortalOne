import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {configuredZetaris,type ZetarisResult} from '../src/lib/server/zetaris';

// Deliberately small hand-coded baseline for the SAME public/synthetic question.
// It illustrates the joins/aggregation an application must own without the USL.
const client=configuredZetaris();
const config=JSON.parse(readFileSync('data/zetaris-usl-v1/queries.json','utf8')) as {
  exploration:{id:string;sql:string}[];verification:{id:string;sql:string}[];
};
function objects(result:ZetarisResult){return result.data.map(row=>Object.fromEntries(result.headers.map((name,index)=>[name,row[index]])));}
const sources=[config.exploration.find(query=>query.id==='community-logistics-scope')!.sql,
  'SELECT depot_id, available_units, expires_at, simulated FROM PORTALONE_LOGISTICS_V1.inventory',
  'SELECT depot_id, available FROM PORTALONE_LOGISTICS_V1.vehicles',
  'SELECT route_id, sequence, from_node, distance_km, travel_minutes, max_gross_kg, expires_at, simulated FROM PORTALONE_SCENARIO_V1.route_segments'];
const sourceResults:ZetarisResult[]=[];
const manualStarted=performance.now();
for(const sql of sources)sourceResults.push(await client.query(sql));
const [places,inventory,vehicles,segments]=sourceResults.map(objects);
const truth=(value:unknown)=>value===true||value==='true';
const manual=places!.flatMap(place=>{
  const stock=inventory!.filter(row=>row['depot_id']===place['depot_id']);
  const routes=[...new Set(segments!.filter(row=>Number(row['sequence'])===1&&row['from_node']===place['depot_id']).map(row=>row['route_id']))];
  return routes.map(routeId=>{
    const route=segments!.filter(row=>row['route_id']===routeId);
    return [place['place_id'],place['name'],place['depot_id'],
      stock.reduce((sum,row)=>sum+Number(row['available_units']),0),
      vehicles!.filter(row=>row['depot_id']===place['depot_id']&&truth(row['available'])).length,
      routeId,route.reduce((sum,row)=>sum+Number(row['distance_km']),0),
      route.reduce((sum,row)=>sum+Number(row['travel_minutes']),0),Math.min(...route.map(row=>Number(row['max_gross_kg']))),
      stock.map(row=>String(row['expires_at'])).sort()[0],route.map(row=>String(row['expires_at'])).sort()[0],
      truth(place['simulated'])&&stock.every(row=>truth(row['simulated']))&&route.every(row=>truth(row['simulated']))];
  });
});
const manualElapsedMs=Math.round(performance.now()-manualStarted);
const semanticStarted=performance.now();
const semantic=await client.query(config.verification.find(query=>query.id==='three-source-mission-context')!.sql);
const semanticElapsedMs=Math.round(performance.now()-semanticStarted);
function normalize(rows:unknown[][]){return rows.map(row=>row.map((value,index)=>[3,4,6,7,8].includes(index)?Number(value):String(value))).sort((a,b)=>String(a[5]).localeCompare(String(b[5])));}
assert.deepEqual(normalize(manual),normalize(semantic.data));
const result={at:new Date().toISOString(),scope:'The same public reference plus synthetic stock/fleet/route question. No report data queried.',
  equivalence:true,sourceRowsFetched:sourceResults.reduce((sum,result)=>sum+result.data.length,0),semanticRowsReturned:semantic.data.length,
  manualSourceRequests:sources.length,semanticRequests:1,manualElapsedMs,semanticElapsedMs,
  timingCaveat:'One sequential local observation; cache, source pushdown and connection warm-up differ. This is not a speed benchmark or measured NGO staff-time saving.',
  observations:'The USL owns cross-source joins and aggregate definitions. The manual baseline owns grouping, matching, type normalization and provenance-related fields in application code.',
  sources,semanticSql:config.verification.find(query=>query.id==='three-source-mission-context')!.sql};
mkdirSync('.runtime/usl',{recursive:true});writeFileSync('.runtime/usl/comparison.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
