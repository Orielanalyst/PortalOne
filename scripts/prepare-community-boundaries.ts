import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

// geoBoundaries gbOpen CMR ADM2, immutable upstream revision supplied by its API.
const url='https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/CMR/ADM2/geoBoundaries-CMR-ADM2.geojson';
const directory=resolve('data/community-boundaries-v1');
const sha=(bytes:string|Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
if(existsSync(resolve(directory,'manifest.json'))){const manifest=JSON.parse(readFileSync(resolve(directory,'manifest.json'),'utf8'));if(sha(readFileSync(resolve(directory,manifest.file)))!==manifest.sha256)throw new Error('Boundary integrity mismatch');console.log('Pinned administrative boundary verified.');process.exit(0);}
const response=await fetch(url,{signal:AbortSignal.timeout(30_000)});if(!response.ok)throw new Error('Pinned boundary source unavailable.');
const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>10_000_000)throw new Error('Boundary acquisition budget exceeded.');
const source=JSON.parse(new TextDecoder().decode(bytes));
const selected=source.features.filter((feature:any)=>String(feature.properties.shapeName).toLowerCase()==='mezam');
if(selected.length!==1 || !['Polygon','MultiPolygon'].includes(selected[0].geometry.type))throw new Error('Expected one sourced Mezam department boundary.');
const feature=selected[0];feature.id=feature.properties.shapeID;
feature.properties={...feature.properties,name:'Mezam department',source_url:url,source_year:2016,status:'administrative_reference_not_intervention_boundary',license:'CC BY 4.0',attribution:'geoBoundaries / Open Africa',evidenceId:'boundary-'+feature.properties.shapeID};
const content=JSON.stringify({type:'FeatureCollection',features:[feature]})+'\n';mkdirSync(directory,{recursive:true});
writeFileSync(resolve(directory,'boundaries.geojson'),content);
writeFileSync(resolve(directory,'manifest.json'),JSON.stringify({version:'mezam-gbopen-adm2-9469f09',file:'boundaries.geojson',features:1,sha256:sha(content),sourceSha256:sha(bytes),sourceUrl:url,metadataUrl:'https://www.geoboundaries.org/api/current/gbOpen/CMR/ADM2/',sourceYear:2016,upstreamCommit:'9469f09',attribution:'geoBoundaries / Open Africa',license:'Creative Commons Attribution 4.0 International',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',limits:'Department reference geometry representing 2016. It does not define beneficiary coverage, a surveyed intervention zone, current jurisdiction verification or a security perimeter.'},null,2)+'\n');
writeFileSync(resolve(directory,'LICENSE.txt'),'Mezam administrative boundary: geoBoundaries gbOpen / Open Africa.\nCreative Commons Attribution 4.0 International (CC BY 4.0)\nhttps://creativecommons.org/licenses/by/4.0/\nSource: '+url+'\nBoundary year represented: 2016. Upstream revision: 9469f09.\n');
console.log(JSON.stringify({features:1,sourceYear:2016,license:'CC BY 4.0',sha256:sha(content)}));
