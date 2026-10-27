import { useEffect, useRef, useState } from 'react';
import type { MissionView } from '../lib/server/mission-runtime';
import type { FeatureCollection, Feature, LineString, Position } from 'geojson';
import type * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type {AreaMapJob} from '../lib/area-geography';

const textNode=(text:string)=>{const node=document.createElement('span');node.textContent=text;return node;};
const reference=(coordinates:unknown):number[]|null=>{
  if(!Array.isArray(coordinates))return null;
  return typeof coordinates[0]==='number'?coordinates as number[]:reference(coordinates[0]);
};
export function CommunityMapView({ view,area }: { view: MissionView;area?:AreaMapJob }) {
  const element=useRef<HTMLDivElement>(null), map=useRef<Leaflet.Map|null>(null);
  const overlays=useRef<Leaflet.LayerGroup|null>(null), facilities=useRef<Leaflet.LayerGroup|null>(null);
  const roadCandidates=useRef<Leaflet.LayerGroup|null>(null), reportPoints=useRef<Leaflet.LayerGroup|null>(null);
  const routeBounds=useRef<Leaflet.LatLngBounds|null>(null), lastFramed=useRef('');
  const [ready,setReady]=useState(false),[error,setError]=useState(false),[counts,setCounts]=useState({roads:0,facilities:0});
  const [showFacilities,setShowFacilities]=useState(true),[showReports,setShowReports]=useState(true),[showCandidates,setShowCandidates]=useState(true);
  const areaMap=area?.map,route=areaMap?undefined:view.planning?.route;
  const sourceBounds=areaMap?.bounds??view.map.bounds;
  const layerUrl=(layer:string)=>area?`/api/geography?session=${encodeURIComponent(area.sessionId)}&job=${encodeURIComponent(area.id)}&layer=${layer}`:'/api/map/'+layer;
  const framing=(bounds:Leaflet.LatLngBounds)=>{
    const compact=(element.current?.clientWidth??0)<=600;
    map.current?.fitBounds(bounds,{paddingTopLeft:[45,compact?45:118],paddingBottomRight:[45,compact?45:155],maxZoom:14,animate:false});
  };
  useEffect(()=>{
    let cancelled=false;const abort=new AbortController();let resize:ResizeObserver|undefined;
    setReady(false);setError(false);setCounts({roads:0,facilities:0});lastFramed.current='';
    void(async()=>{
      try{
        const L=await import('leaflet');
        const layers=await Promise.all(['roads','places','facilities','boundaries'].map(async name=>{
          if(areaMap&&name==='boundaries')return {type:'FeatureCollection',features:[]} as FeatureCollection;
          const response=await fetch(layerUrl(name),{signal:abort.signal});if(!response.ok)throw new Error('Map data unavailable');return response.json() as Promise<FeatureCollection>;
        }));
        if(cancelled||!element.current)return;
        const instance=L.map(element.current,{zoomControl:false,preferCanvas:true,minZoom:9});map.current=instance;
        // Canvas panes span the map; keep report paths below interactive facility markers.
        for(const [name,z] of [['geography',230],['boundary',250],['candidates',390],['mission',420],['reports',450],['facilities',460],['endpoints',530]] as const)instance.createPane(name).style.zIndex=String(z);
        L.control.zoom({position:'topright'}).addTo(instance);
        L.control.scale({position:'bottomleft',imperial:false,maxWidth:110}).addTo(instance);
        const [west,south,east,north]=sourceBounds as [number,number,number,number];
        if(areaMap)instance.setView([areaMap.place.lat,areaMap.place.lng],13);
        else instance.fitBounds([[south,west],[north,east]],{padding:[32,32]});
        L.geoJSON(layers[0],{pane:'geography',filter:f=>['LineString','MultiLineString'].includes(f.geometry.type),
          style:f=>({color:['trunk','primary','secondary'].includes(f?.properties?.['highway'])?'#6f858d':'#46575d',weight:['trunk','primary'].includes(f?.properties?.['highway'])?2.2:1,opacity:.7}),
          onEachFeature:(f,layer)=>layer.bindTooltip(textNode(String(f.properties?.['name']??'Mapped road')+' · present condition unknown'))
        }).addTo(instance);
        L.rectangle([[south,west],[north,east]],{pane:'boundary',color:'#91a5a6',weight:1,dashArray:'3 6',fill:false})
          .bindTooltip(textNode('Acquired map coverage extent · not an administrative or intervention boundary')).addTo(instance);
        L.geoJSON(layers[3],{pane:'boundary',style:{color:'#8bb6b0',weight:2,dashArray:'10 6',fill:false},
          onEachFeature:(_f,layer)=>layer.bindTooltip(textNode('Mezam department · geoBoundaries / Open Africa, 2016 · administrative reference only'))
        }).addTo(instance);
        L.geoJSON(layers[1],{pane:'geography',pointToLayer:(_f,ll)=>L.circleMarker(ll,{pane:'geography',radius:2.5,color:'#97a7a7',weight:1,fillOpacity:.7}),
          onEachFeature:(f,layer)=>layer.bindTooltip(textNode(String(f.properties?.['name']??'Mapped settlement')))}).addTo(instance);
        if(areaMap)L.marker([areaMap.place.lat,areaMap.place.lng],{pane:'endpoints',icon:L.divIcon({className:'selected-area-reference',html:'<span>◎</span>',iconSize:[32,32],iconAnchor:[16,16]})})
          .bindTooltip(textNode(areaMap.place.name+' · source place reference'),{permanent:true,direction:'right',offset:[18,0],className:'endpoint-label'}).addTo(instance);
        facilities.current=L.layerGroup().addTo(instance);
        layers[2]!.features.forEach((f,index)=>{
          const xy=reference('coordinates' in f.geometry?f.geometry.coordinates:null);if(!xy)return;
          if(f.geometry.type!=='Point')L.geoJSON(f,{pane:'facilities',style:{color:'#64c9c1',weight:2,fillColor:'#64c9c1',fillOpacity:.18}}).addTo(facilities.current!);
          const popup=document.createElement('div');
          const title=document.createElement('strong');title.textContent='H'+(index+1)+' · '+String(f.properties?.['name']??'Unnamed mapped health facility');popup.append(title);
          const detail=document.createElement('p');detail.textContent='Capacity and operation unverified. This is a source geometry reference, not a confirmed entrance.';popup.append(detail);
          const source=String(f.properties?.['evidenceId']??f.id??'').replace('facilities-','').replace(':','/');
          if(/^(node|way|relation)\/\d+$/.test(source)){const link=document.createElement('a');link.href='https://www.openstreetmap.org/'+source;link.target='_blank';link.rel='noreferrer';link.textContent='Open mapped source';popup.append(link);}
          const compact=(element.current?.clientWidth??0)<=600;
          L.marker([xy[1]!,xy[0]!],{pane:'facilities',icon:L.divIcon({className:'health-map-marker',html:'<span>✚</span>',iconSize:[25,25],iconAnchor:[12,12]})})
            .bindTooltip(textNode('H'+(index+1)+' · '+String(f.properties?.['name']??'Health facility')),{direction:'top'})
            .bindPopup(popup,{autoPanPaddingTopLeft:[compact?20:360,compact?20:170],autoPanPaddingBottomRight:[20,compact?20:155]}).addTo(facilities.current!);
        });
        reportPoints.current=L.layerGroup().addTo(instance);roadCandidates.current=L.layerGroup().addTo(instance);overlays.current=L.layerGroup().addTo(instance);
        instance.attributionControl.addAttribution('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · HOT / HDX · ODbL'+(areaMap?'':' | <a href="https://www.geoboundaries.org">geoBoundaries</a> / Open Africa · CC BY 4.0'));
        setCounts({roads:layers[0]!.features.filter(f=>['LineString','MultiLineString'].includes(f.geometry.type)).length,facilities:layers[2]!.features.length});
        resize=new ResizeObserver(()=>instance.invalidateSize({animate:false}));resize.observe(element.current);
        setReady(true);
      }catch{if(!cancelled)setError(true);}
    })();
    return()=>{cancelled=true;abort.abort();resize?.disconnect();map.current?.remove();map.current=null;overlays.current=null;setReady(false);};
  },[view.map.version,areaMap?.key]);
  const signature=JSON.stringify([view.selected?.id,view.groundings,view.signals.map(s=>[s.id,s.mode,s.placeName]),view.roadGroundings,route?.id,areaMap?.key]);
  useEffect(()=>{
    if(!ready||!overlays.current)return;let cancelled=false;
    void import('leaflet').then(L=>{
      if(cancelled||!overlays.current||!roadCandidates.current||!reportPoints.current)return;
      overlays.current.clearLayers();roadCandidates.current.clearLayers();reportPoints.current.clearLayers();
      if(areaMap)return;
      const grouped=new Map<string,{lat:number;lng:number;count:number;demo:boolean;place:string;gap:string|null}>();
      for(const grounding of view.groundings){if(!grounding.location)continue;const signal=view.signals.find(s=>s.id===grounding.signalId);if(!signal)continue;
        const key=JSON.stringify(grounding.location),prior=grouped.get(key);
        grouped.set(key,{...grounding.location,count:(prior?.count??0)+1,demo:signal.mode==='demo',place:signal.placeName,gap:grounding.gap});
      }
      for(const g of grouped.values()){
        const description=(g.demo?'DEMONSTRATION · ':'UNVERIFIED · ')+g.place+' · '+g.count+' report(s). '+g.gap;
        L.circleMarker([g.lat,g.lng],{pane:'reports',radius:20,color:'#e6b564',weight:2,dashArray:'4 4',fillOpacity:.05}).bindTooltip(textNode(description)).addTo(reportPoints.current);
        L.marker([g.lat,g.lng],{pane:'reports',icon:L.divIcon({className:'report-map-marker',html:'<span>▲</span><b>'+g.count+'</b>',iconSize:[28,24],iconAnchor:[-16,35]})})
          .bindTooltip(textNode(description+' Symbol offset for legibility; the underlying reference is unchanged.')).addTo(reportPoints.current);
      }
      const drawn=new Set<string>();
      for(const match of view.roadGroundings??[])for(const candidate of match.candidates){if(drawn.has(candidate.id))continue;drawn.add(candidate.id);
        L.geoJSON({type:'Feature',geometry:candidate.geometry,properties:{}} as Feature<LineString>,{pane:'candidates',style:{color:'#f0b04e',weight:4,dashArray:'4 6',opacity:.9},
          onEachFeature:(_f,layer)=>layer.bindTooltip(textNode('Possible report-to-road match · '+candidate.roadId+'. '+match.gap))}).addTo(roadCandidates.current);
      }
      if(route?.geometry){
        const feature:Feature<LineString>={type:'Feature',geometry:route.geometry,properties:{}};
        L.geoJSON(feature,{pane:'mission',interactive:false,style:{color:'#171c25',weight:11,opacity:1,lineCap:'round',lineJoin:'round'}}).addTo(overlays.current);
        L.geoJSON(feature,{pane:'mission',interactive:false,style:{color:'#f5ecff',weight:8,opacity:.95,lineCap:'round',lineJoin:'round'}}).addTo(overlays.current);
        const line=L.geoJSON(feature,{pane:'mission',style:{color:'#9d76ff',weight:4.5,opacity:1,lineCap:'round',lineJoin:'round'},
          onEachFeature:(_f,layer)=>layer.bindTooltip(textNode('Mission route candidate · '+route.distanceKm+' km · passability and endpoint access unverified'))}).addTo(overlays.current);
        routeBounds.current=line.getBounds();
        const points=route.geometry.coordinates;
        for(const [xy,letter,name,kind] of [[points[0]!,'A',route.from,'Origin road reference'],[points.at(-1)!,'B',route.to,'Destination road reference']] as [Position,string,string,string][]){
          L.marker([xy[1]!,xy[0]!],{pane:'endpoints',icon:L.divIcon({className:'mission-endpoint '+(letter==='B'?'mission-target':''),html:'<span>'+letter+'</span>',iconSize:[34,34],iconAnchor:[17,17]})})
            .bindTooltip(textNode(letter+' · '+name),{permanent:true,direction:letter==='B'?'left':'right',offset:[letter==='B'?-18:18,0],className:'endpoint-label'})
            .bindPopup(textNode(kind+' · '+name+'. Actual loading/unloading entrance and last-mile access require field confirmation.')).addTo(overlays.current);
        }
        if(lastFramed.current!==route.id){framing(routeBounds.current);lastFramed.current=route.id;}
      }else routeBounds.current=null;
    });
    return()=>{cancelled=true;};
  },[ready,signature]);
  useEffect(()=>{if(!ready||!map.current)return;for(const [group,visible] of [[facilities.current,showFacilities],[reportPoints.current,showReports],[roadCandidates.current,showCandidates]] as const){if(group){if(visible)map.current.addLayer(group);else map.current.removeLayer(group);}}},[ready,showFacilities,showReports,showCandidates]);
  const overview=()=>{const [w,s,e,n]=sourceBounds as [number,number,number,number],compact=(element.current?.clientWidth??0)<=600;map.current?.fitBounds([[s,w],[n,e]],{paddingTopLeft:[35,compact?35:118],paddingBottomRight:[35,compact?35:155],animate:false});};
  return <div className="community-map">
    <div ref={element} className="map-canvas" aria-label={areaMap?areaMap.place.name+' source map with roads and health features':'Mission map with traced route, source boundaries and health facilities'}/>
    <div className="map-caption"><span className="eyebrow">{areaMap?'AREA REFERENCE · FIELD CONDITIONS UNVERIFIED':'MISSION GEOGRAPHY · FIELD CONDITIONS UNVERIFIED'}</span><h2>{areaMap?areaMap.place.name+' reference map':route?.geometry?route.from+' → '+route.to:'Bamenda–Bambili evidence map'}</h2>
      <p>{ready?<>{route?.geometry?route.distanceKm+' km mapped route candidate · ':''}{counts.facilities} health features · {counts.roads.toLocaleString()} road features</>:'Loading source layers…'}</p>
      <div className="map-frame-controls">{!areaMap&&<button onClick={()=>routeBounds.current&&framing(routeBounds.current)} disabled={!route?.geometry}>Frame mission route</button>}{areaMap&&<button onClick={()=>map.current?.setView([areaMap.place.lat,areaMap.place.lng],13,{animate:false})}>Town reference</button>}<button onClick={overview}>{areaMap?'Coverage extent':'Coverage overview'}</button></div>
      {areaMap&&<p className="area-source-date">Source acquired {new Date(areaMap.sourceAcquiredAt).toLocaleDateString()} · ±5 km viewing window</p>}
      {areaMap&&<div className="area-downloads">{['roads','facilities','places','manifest'].map(layer=><a key={layer} href={layerUrl(layer)+'&download=1'}>{layer==='manifest'?'Source manifest':layer+' GeoJSON'} ↗</a>)}</div>}
    </div>
    <div className="map-north" aria-label="North arrow"><b>N</b><span>↑</span></div>
    {!ready&&<div className="map-loading" role="status">{error?<><span className="map-loading-mark">!</span><strong>Map unavailable</strong><span>Check the local map files, then reload.</span></>:<><span className="working-ring" /><strong>Loading map geography…</strong><span>Roads, health features and source extent</span></>}</div>}
    <div className="map-legend" aria-label="Map legend">{!areaMap&&<><span><i className="mission-route-key"/>Mission route · unverified</span><span><i className="target-key">B</i>Destination reference</span></>}
      <label><input type="checkbox" checked={showFacilities} onChange={e=>setShowFacilities(e.target.checked)}/><i className="facility-key"/>Health facilities</label>
      {!areaMap&&<><label><input type="checkbox" checked={showReports} onChange={e=>setShowReports(e.target.checked)}/><i className="report-key"/>Report references</label>
      <label><input type="checkbox" checked={showCandidates} onChange={e=>setShowCandidates(e.target.checked)}/><i className="candidate-key"/>Possible road matches</label>
      <span><i className="boundary-key"/>Mezam department · 2016</span></>}
      <p>{areaMap?'Source geography only. Dashed frame is an extraction window, not an administrative boundary. Facility operation, capacity and road conditions are unknown.':'Dashed gray frame: acquired data extent. No surveyed intervention boundary is available. Reference points do not confirm incidents or entrances.'}</p></div>
  </div>;
}
