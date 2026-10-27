import {useEffect,useState} from 'react';
import {ArrowUpRight,Check,MapPin,Search,ArrowRight} from 'lucide-react';
import type {AreaMapJob,AreaPlace} from '../lib/area-geography';
export function AreaMapActivity({job,onOpen}:{job:AreaMapJob;onOpen:()=>void}){
  return <section className="area-map-activity" aria-label={'Area mapping: '+job.area}>
    <div><span className={job.status==='building'?'working-ring':'area-map-icon'}>{job.status!=='building'&&<MapPin size={15}/>}</span><strong>{job.map?.place.name??job.area}</strong><span className="area-map-status">{job.status==='building'?'Mapping':job.status==='ready'?'Map ready':job.status==='choose_place'?'Choose location':'Needs attention'}</span></div>
    <p>{job.status==='building'?job.steps.at(-1)?.detail:job.map?`${job.map.counts.roads.toLocaleString()} road features · ${job.map.counts.facilities} mapped health features`:job.error}</p>
    <button type="button" onClick={onOpen}>{job.status==='ready'?'Open area map':'View mapping progress'}<ArrowUpRight size={13}/></button>
  </section>;
}
export function AreaMapSearch({sessionId,busy,onStarted,job}:{sessionId:string;busy:boolean;onStarted:()=>void;job?:AreaMapJob}){
  const [query,setQuery]=useState(''),[places,setPlaces]=useState<AreaPlace[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[sending,setSending]=useState(false),[searched,setSearched]=useState(false);
  useEffect(()=>{setQuery('');setPlaces([]);setError('');setSearched(false);},[sessionId]);
  useEffect(()=>{if(query.trim().length<2){setPlaces([]);setLoading(false);setSearched(false);return;}const abort=new AbortController();
    setPlaces([]);setSearched(false);setLoading(true);setError('');
    const timer=setTimeout(()=>{void fetch('/api/geography?q='+encodeURIComponent(query.trim()),{signal:abort.signal}).then(async response=>{const value=await response.json();if(!response.ok)throw new Error(value.error);setPlaces(value.places);setSearched(true);}).catch(error=>{if(!abort.signal.aborted)setError(error instanceof Error?error.message:'Place search is unavailable.');}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});},350);
    return()=>{clearTimeout(timer);abort.abort();};
  },[query]);
  async function choose(place:AreaPlace){setSending(true);setError('');try{const response=await fetch('/api/geography',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,area:place.name,placeId:place.id})});const value=await response.json();if(!response.ok)throw new Error(value.error);setQuery('');setPlaces([]);onStarted();}catch(error){setError(error instanceof Error?error.message:'Map request failed.');}finally{setSending(false);}}
  const candidates=query.trim().length>=2?places:job?.status==='choose_place'?job.candidates:[];
  return <div className="area-map-search"><div className="area-search-field"><Search size={16}/><input aria-label="Find a Cameroon location" placeholder="Find another location in Cameroon…" value={query} onChange={event=>setQuery(event.target.value)} autoComplete="off"/><span>{loading?<span className="working-ring"/>:<kbd>Place</kbd>}</span></div>
    {(loading||error||candidates.length>0||searched&&query.trim().length>=2)&&<div className="area-search-results" aria-live="polite">
      {loading?<p><span className="working-ring"/>Searching the source gazetteer…</p>:error?<p role="alert">{error}</p>:candidates.length?candidates.map(place=><button type="button" key={place.id} disabled={busy||sending} onClick={()=>void choose(place)}><MapPin size={16}/><span><strong>{place.name}</strong><small>{place.kind} · {place.lat.toFixed(4)}, {place.lng.toFixed(4)} · source reference</small></span><ArrowRight size={15}/></button>):<p>No source match. Try a town or village name in Cameroon.</p>}
      {candidates.length>0&&busy&&<p>Wait for the current work to finish before starting another map.</p>}
    </div>}
  </div>;
}
export function AreaMapTrace({job}:{job:AreaMapJob}){return <div className="area-map-trace"><div className="area-trace-title"><MapPin size={16}/><strong>Mapping {job.area}</strong><span>{job.status==='ready'?'Complete':job.status==='building'?'In progress':'Needs input'}</span></div><ol>{job.steps.map((step,index)=><li key={index}><span>{index===job.steps.length-1&&job.status==='building'?<span className="working-ring"/>:<Check size={13}/>}</span><div><strong>{step.actor}</strong><p>{step.detail}</p></div></li>)}</ol></div>;}
