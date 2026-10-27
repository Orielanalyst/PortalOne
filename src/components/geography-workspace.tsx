import {useEffect,useState} from 'react';
import {MapPin,Layers} from 'lucide-react';
import type {MissionView} from '../lib/server/mission-runtime';
import {CommunityMapView} from './community-map';
import {AreaMapSearch,AreaMapTrace} from './area-map-tools';
import {AgentLoading} from './agent-loading';
export function GeographyWorkspace({view}:{view:MissionView}){
  const job=view.areaMaps?.[0], [mode,setMode]=useState<'mission'|'area'>(job?'area':'mission');
  useEffect(()=>{setMode(job?'area':'mission');},[job?.id,view.session.id]);
  return <div className="geography-workspace"><div className="geography-tools"><AreaMapSearch sessionId={view.session.id} busy={!!view.activeRunId||view.chatBusy||view.mappingBusy||view.reviewBusy} job={job} onStarted={()=>setMode('area')}/>
    <div className="geography-mode"><button type="button" onClick={()=>setMode('mission')} aria-pressed={mode==='mission'}><Layers size={13}/>Mission coverage</button>{job&&<button type="button" onClick={()=>setMode('area')} aria-pressed={mode==='area'}><MapPin size={13}/>{job.map?.place.name??job.area}</button>}</div></div>
    <div className="geography-map-body">{mode==='area'&&job?job.status==='ready'?<CommunityMapView key={job.id} view={view} area={job}/>:<div className="geography-pending"><span className="eyebrow">AREA MAPPING</span><h2>{job.area}</h2>{job.status==='building'?<AgentLoading startedAt={job.startedAt} title="Building the area map" detail={job.steps.at(-1)?.detail}/>:<p className="geography-gap">{job.error} Use the location search above to choose a source location.</p>}<AreaMapTrace job={job}/></div>:<CommunityMapView key="mission" view={view}/>}</div>
  </div>;
}
