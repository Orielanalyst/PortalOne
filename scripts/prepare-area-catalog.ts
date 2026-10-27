import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync,createWriteStream,renameSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {once} from 'node:events';
import shp from 'shpjs';
import {iter} from 'but-unzip';
import {featureBounds} from '../src/lib/area-geography.ts';
import type {AreaPlace} from '../src/lib/area-geography.ts';
import type {Feature,FeatureCollection} from 'geojson';

// Reuses the pinned HOT/HDX archives and parsers already used for the corridor.
// Country-sized parsing runs in this CLI process, outside the web event loop.
const root=resolve('.runtime/area-catalog'),cache=resolve('.runtime/map-acquisition');
const manifest=JSON.parse(readFileSync('data/community-map-v1/manifest.json','utf8'));
const hash=(value:Uint8Array|string)=>createHash('sha256').update(value).digest('hex');
const sourceKey=hash(JSON.stringify(manifest.sources.map((source:any)=>[source.layer,source.archiveSha256])));
const signal=AbortSignal.timeout(240_000);
const emit=(detail:string)=>console.log(JSON.stringify({detail}));
mkdirSync(root,{recursive:true});mkdirSync(cache,{recursive:true});
if(existsSync(resolve(root,'manifest.json'))&&JSON.parse(readFileSync(resolve(root,'manifest.json'),'utf8')).sourceKey===sourceKey&&JSON.parse(readFileSync(resolve(root,'manifest.json'),'utf8')).version===2&&['roads','facilities','places'].every(layer=>existsSync(resolve(root,layer+'.ndjson')))){emit('Verified existing Cameroon geography catalog.');process.exit(0);}
const places:AreaPlace[]=[],files:Record<string,unknown>={};
const keep=['id','osm_id','osm_type','name','name:en','name:fr','highway','surface','bridge','access','oneway','amenity','healthcare','place'];
for(const source of manifest.sources){
  signal.throwIfAborted();const path=resolve(cache,source.layer+'.zip');
  if(!existsSync(path)){
    emit('Downloading the pinned '+source.layer+' reference archive.');
    const response=await fetch(source.url,{signal});if(!response.ok)throw new Error('Reference archive unavailable.');
    const reader=response.body!.getReader(),chunks:Uint8Array[]=[];let bytes=0;
    for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>120_000_000){await reader.cancel();throw new Error('Archive exceeds the acquisition budget.');}chunks.push(part.value);}
    const archive=Buffer.concat(chunks);if(hash(archive)!==source.archiveSha256)throw new Error('Remote source changed from the pinned snapshot. Obtain a reviewed new version.');writeFileSync(path,archive);
  }
  const bytes=readFileSync(path);if(hash(bytes)!==source.archiveSha256)throw new Error('Reference archive integrity check failed.');
  emit('Indexing '+source.layer+' from the verified Cameroon snapshot.');
  const entries=[...iter(bytes)],json=entries.find(entry=>/\.geojson$/i.test(entry.filename));
  const parsed=json?JSON.parse(new TextDecoder().decode(await json.read())):await shp(bytes);
  const collections=(Array.isArray(parsed)?parsed:[parsed]) as FeatureCollection[];
  const temporary=resolve(root,source.layer+'.ndjson.tmp'),destination=resolve(root,source.layer+'.ndjson');
  const output=createWriteStream(temporary),indexHash=createHash('sha256');let count=0;
  try{
    for(const collection of collections.filter(item=>Array.isArray(item.features)))for(const feature of collection.features){
      const properties=feature.properties??{};
      if(source.layer==='roads'&&!['LineString','MultiLineString'].includes(feature.geometry?.type))continue;
      if(source.layer==='places'&&(!properties['place']||feature.geometry?.type!=='Point'))continue;
      const bounds=featureBounds(feature);if(!bounds)continue;
      const id=source.layer+'-'+String(properties['osm_id']??properties['id']??feature.id??count).replaceAll('/',':');
      const clean:Feature={type:'Feature',id,geometry:feature.geometry,properties:{...Object.fromEntries(keep.filter(key=>properties[key]!=null).map(key=>[key,properties[key]])),evidenceId:id,layer:source.layer}};
      const line=JSON.stringify({bounds,feature:clean})+'\n';indexHash.update(line);
      if(!output.write(line))await once(output,'drain');count++;
      if(source.layer==='places'&&properties['name']&&clean.geometry.type==='Point')places.push({id,name:String(properties['name']),kind:String(properties['place']),lng:clean.geometry.coordinates[0]!,lat:clean.geometry.coordinates[1]!});
    }
    output.end();await once(output,'finish');renameSync(temporary,destination);
  }catch(error){output.destroy();rmSync(temporary,{force:true});throw error;}
  files[source.layer]={features:count,sourceSha256:source.archiveSha256,sha256:indexHash.digest('hex')};emit('Indexed '+count+' '+source.layer+' features.');
}
const placeJson=JSON.stringify(places);writeFileSync(resolve(root,'places.json'),placeJson);
writeFileSync(resolve(root,'manifest.json'),JSON.stringify({version:2,sourceKey,placesSha256:hash(placeJson),preparedAt:new Date().toISOString(),sourceAcquiredAt:manifest.preparedAt,attribution:manifest.attribution,license:manifest.license,sourceUrls:manifest.sources.map((source:any)=>source.url),files}));
emit('Cameroon reference catalog ready.');
