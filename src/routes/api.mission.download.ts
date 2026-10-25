import { createFileRoute } from '@tanstack/react-router';
import { missionRuntime, requireLocalRequest } from '../lib/server/mission-runtime';
import { readBundleFile } from '../lib/server/committee-export';
export const Route=createFileRoute('/api/mission/download')({server:{handlers:{GET:async({request})=>{
  try {
    requireLocalRequest(request); const query=new URL(request.url).searchParams,runId=query.get('run') ?? '',name=query.get('file') ?? '';
    const bundle=missionRuntime().journal.bundle(runId); if(bundle?.status!=='ready') return new Response(null,{status:404});
    const file=bundle.files.find(file=>file.name===name); if(!file) return new Response(null,{status:404});
    const bytes=readBundleFile(runId,name,file.sha256);
    const type=name.endsWith('.pdf')?'application/pdf':name.endsWith('.zip')?'application/zip':name.endsWith('.geojson')?'application/geo+json':name.endsWith('.gpkg')?'application/geopackage+sqlite3':'application/octet-stream';
    return new Response(bytes,{headers:{'Content-Type':type,'Content-Disposition':`attachment; filename="${name.split('/').at(-1)}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  } catch{return new Response(null,{status:503});}
}}}});
