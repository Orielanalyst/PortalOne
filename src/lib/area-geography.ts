import type {Feature,FeatureCollection} from 'geojson';
export type AreaPlace={id:string;name:string;kind:string;lat:number;lng:number};
export type AreaMap={key:string;place:AreaPlace;bounds:[number,number,number,number];halfWidthKm:number;createdAt:string;sourceAcquiredAt:string;
  counts:{roads:number;facilities:number;places:number};files:Record<string,{sha256:string;features:number}>;attribution:string;limits:string;sourceUrls:string[]};
export type AreaMapJob={id:string;sessionId:string;turnId:string|null;area:string;status:'building'|'choose_place'|'ready'|'failed';startedAt:string;updatedAt:string;
  steps:{actor:string;detail:string;at:string}[];candidates:AreaPlace[];map:AreaMap|null;error:string|null};
export const normalizePlace=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[,\s]+cameroon$/,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function findAreaPlaces(places:AreaPlace[],query:string):AreaPlace[]{
  const name=normalizePlace(query);if(name.length<2)return [];
  const exact=places.filter(place=>normalizePlace(place.name)===name);
  return (exact.length?exact:places.filter(place=>normalizePlace(place.name).includes(name))).slice(0,12);
}
export function areaBounds(place:AreaPlace,halfWidthKm=5):[number,number,number,number]{
  if(![place.lat,place.lng,halfWidthKm].every(Number.isFinite)||Math.abs(place.lat)>85||Math.abs(place.lng)>180||halfWidthKm<1||halfWidthKm>8)throw new Error('Invalid area extent.');
  const dy=halfWidthKm/111.32,dx=dy/Math.cos(place.lat*Math.PI/180);
  return [place.lng-dx,place.lat-dy,place.lng+dx,place.lat+dy];
}
export function featureBounds(feature:Feature):number[]|null{
  const box=[Infinity,Infinity,-Infinity,-Infinity];
  const visit=(value:unknown):void=>{if(!Array.isArray(value))return;if(typeof value[0]==='number'&&typeof value[1]==='number'){
    if(!Number.isFinite(value[0])||!Number.isFinite(value[1])||Math.abs(value[0])>180||Math.abs(value[1])>90)throw new Error('Invalid source coordinate.');
    box[0]=Math.min(box[0]!,value[0]);box[1]=Math.min(box[1]!,value[1]);box[2]=Math.max(box[2]!,value[0]);box[3]=Math.max(box[3]!,value[1]);
  }else value.forEach(visit);};
  if(feature.geometry&&'coordinates'in feature.geometry)visit(feature.geometry.coordinates);
  return box.every(Number.isFinite)?box:null;
}
export const overlaps=(box:number[],extent:number[])=>box[0]!<=extent[2]!&&box[2]!>=extent[0]!&&box[1]!<=extent[3]!&&box[3]!>=extent[1]!;
export const emptyCollection=():FeatureCollection=>({type:'FeatureCollection',features:[]});
