import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync,createReadStream} from 'node:fs';
import {resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {spawn} from 'node:child_process';
import {setImmediate as yieldIO} from 'node:timers/promises';
import {areaBounds,emptyCollection,findAreaPlaces,overlaps} from '../area-geography';
import type {AreaMap,AreaPlace} from '../area-geography';
import type {Feature} from 'geojson';

const root=resolve('.runtime/area-catalog'),maps=resolve('.runtime/area-maps');
const retained=resolve('data/area-geography-v1');
const digest=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
type Catalog={version:number;sourceKey:string;placesSha256:string;sourceAcquiredAt:string;attribution:string;sourceUrls:string[];files:Record<string,{sha256:string}>};
export class AreaGeography {
  private preparing:Promise<void>|null=null;
  private catalog():Catalog{
    const catalog=JSON.parse(readFileSync(existsSync(resolve(root,'manifest.json'))?resolve(root,'manifest.json'):resolve(retained,'catalog.json'),'utf8')) as Catalog;
    const pinned=JSON.parse(readFileSync('data/community-map-v1/manifest.json','utf8'));
    if(catalog.version!==2||catalog.sourceKey!==digest(JSON.stringify(pinned.sources.map((source:any)=>[source.layer,source.archiveSha256]))))throw new Error('Cameroon geography catalog needs preparation.');
    return catalog;
  }
  ready(){try{this.catalog();return true;}catch{return false;}}
  private nationalReady(){return existsSync(resolve(root,'manifest.json'))&&this.ready()&&['roads','facilities','places'].every(layer=>existsSync(resolve(root,layer+'.ndjson')));}
  async prepare(progress:(detail:string)=>void=()=>{}){
    if(this.nationalReady())return;
    if(!this.preparing)this.preparing=new Promise<void>((accept,reject)=>{
      progress('Preparing the verified Cameroon source catalog.');
      const args=process.versions['bun']?['run','scripts/prepare-area-catalog.ts']:['--experimental-strip-types','scripts/prepare-area-catalog.ts'];
      const child=spawn(process.execPath,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
      let line='';child.stdout.on('data',chunk=>{line+=String(chunk);const parts=line.split('\n');line=parts.pop()??'';for(const part of parts)try{const item=JSON.parse(part);if(typeof item.detail==='string')progress(item.detail);}catch{/* ignore non-progress output */}});
      child.stderr.resume();child.on('error',()=>reject(new Error('The geography preparation process could not start.')));
      child.on('exit',code=>code===0?accept():reject(new Error('The pinned geography catalog could not be prepared. Check source availability and local disk space.')));
      const timeout=setTimeout(()=>{child.kill();reject(new Error('Geography preparation exceeded its four-minute budget.'));},240_000);timeout.unref();child.once('close',()=>clearTimeout(timeout));
    }).finally(()=>{this.preparing=null;});
    await this.preparing;
  }
  search(query:string){
    const catalog=this.catalog(),bytes=readFileSync(existsSync(resolve(root,'places.json'))?resolve(root,'places.json'):resolve(retained,'places.json'));
    if(digest(bytes)!==catalog.placesSha256)throw new Error('Place catalog integrity check failed.');
    return findAreaPlaces(JSON.parse(bytes.toString('utf8')) as AreaPlace[],query);
  }
  async build(place:AreaPlace,progress:(detail:string)=>void,signal:AbortSignal,allowAcquisition=true):Promise<AreaMap>{
    const catalog=this.catalog(),halfWidthKm=5,bounds=areaBounds(place,halfWidthKm),key=digest(JSON.stringify([catalog.sourceKey,place.id,bounds]));
    const directory=resolve(maps,key);mkdirSync(directory,{recursive:true});
    const savedManifest=existsSync(resolve(directory,'manifest.json'))?resolve(directory,'manifest.json'):resolve(retained,'maps',key,'manifest.json');
    if(existsSync(savedManifest)){
      const cached=JSON.parse(readFileSync(savedManifest,'utf8')) as AreaMap;
      if(cached.key===key&&cached.place.id===place.id&&['roads','facilities','places'].every(layer=>{
        const bytes=this.file(cached,layer);return (JSON.parse(bytes.toString('utf8')).features?.length===cached.files[layer]?.features);
      })){progress('Reopening the verified saved map for '+place.name+'.');return cached;}
    }
    if(!this.nationalReady()&&!allowAcquisition)throw new Error('This location is not cached for offline mapping. Live mode can prepare the pinned reference catalog.');
    await this.prepare(progress);signal.throwIfAborted();
    const files:AreaMap['files']={},counts={roads:0,facilities:0,places:0};
    for(const layer of ['roads','facilities','places'] as const){
      signal.throwIfAborted();progress('Mapping '+layer+' around '+place.name+' from the verified snapshot.');
      const collection=emptyCollection(),sourceHash=createHash('sha256');let scanned=0;
      const input=createReadStream(resolve(root,layer+'.ndjson'));const lines=createInterface({input,crlfDelay:Infinity});
      try{for await(const line of lines){signal.throwIfAborted();sourceHash.update(line+'\n');const marker=line.indexOf(',"feature":');if(marker<0)throw new Error('Invalid geography index.');
        const row=JSON.parse(line.slice(0,marker)+'}') as {bounds:number[]};
        if(overlaps(row.bounds,bounds))collection.features.push((JSON.parse(line) as {feature:Feature}).feature);
        if(collection.features.length>(layer==='roads'?20_000:2000))throw new Error('This area exceeds the map feature budget. Choose a smaller nearby settlement.');
        if(++scanned%512===0)await yieldIO();
      }}finally{lines.close();input.destroy();}
      if(sourceHash.digest('hex')!==catalog.files[layer]?.sha256)throw new Error('Geography source index integrity check failed.');
      const bytes=JSON.stringify(collection);writeFileSync(resolve(directory,layer+'.geojson'),bytes);counts[layer]=collection.features.length;files[layer]={features:collection.features.length,sha256:digest(bytes)};
    }
    const map:AreaMap={key,place,bounds,halfWidthKm,createdAt:new Date().toISOString(),sourceAcquiredAt:catalog.sourceAcquiredAt,counts,files,attribution:catalog.attribution,license:'ODbL-1.0',licenseUrl:'https://opendatacommons.org/licenses/odbl/1-0/',sourceUrls:catalog.sourceUrls,
      limits:'Source-backed reference geography within a ±5 km viewing window, not a surveyed boundary. Whole overlapping features are retained. Coverage may be incomplete. Facility capacity/operation, road passability, field incidents and delivery logistics remain unverified. This exploration does not expand the committee workflow’s verified corridor.'};
    writeFileSync(resolve(directory,'manifest.json'),JSON.stringify(map,null,2));progress('Area map ready: '+counts.roads+' roads, '+counts.facilities+' health features and '+counts.places+' settlement references.');return map;
  }
  file(map:AreaMap,layer:string){
    if(!/^[a-f0-9]{64}$/.test(map.key)||!['roads','facilities','places','manifest'].includes(layer))throw new Error('Unknown map layer.');
    const name=layer+(layer==='manifest'?'.json':'.geojson');
    const bytes=readFileSync(existsSync(resolve(maps,map.key,'manifest.json'))?resolve(maps,map.key,name):resolve(retained,'maps',map.key,name));
    if(layer!=='manifest'&&digest(bytes)!==map.files[layer]?.sha256)throw new Error('Area map artifact integrity check failed.');
    return bytes;
  }
}
