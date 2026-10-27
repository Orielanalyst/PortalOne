import {createFileRoute} from '@tanstack/react-router';
import {z} from 'zod';
import {missionRuntime,requireLocalRequest} from '../lib/server/mission-runtime';

export const Route=createFileRoute('/api/geography')({server:{handlers:{
  GET:async({request})=>{
    try{requireLocalRequest(request);}catch{return new Response(null,{status:403});}
    const runtime=missionRuntime(),query=new URL(request.url).searchParams,jobId=query.get('job');
    try{
      if(jobId){
        const job=runtime.journal.areaMap(jobId),layer=query.get('layer')??'manifest';
        if(!job?.map||job.status!=='ready'||query.get('session')!==job.sessionId||!['roads','facilities','places','manifest'].includes(layer))return new Response(null,{status:404});
        const bytes=runtime.geography.file(job.map,layer);
        return new Response(new Uint8Array(bytes),{headers:{'Content-Type':layer==='manifest'?'application/json':'application/geo+json','Cache-Control':'private, max-age=3600',
          ...(query.has('download')?{'Content-Disposition':`attachment; filename="${layer}.${layer==='manifest'?'json':'geojson'}"`}:{})}});
      }
      const search=z.string().trim().min(2).max(120).parse(query.get('q'));
      return Response.json({places:runtime.geography.search(search),coverage:'Cameroon source gazetteer',currentConditions:'unverified'},{headers:{'Cache-Control':'no-store'}});
    }catch(error){return Response.json({error:error instanceof z.ZodError?'Enter at least two characters of a Cameroon place name.':error instanceof Error?error.message:'Geography unavailable.'},{status:503});}
  },
  POST:async({request})=>{
    try{requireLocalRequest(request,true);}catch{return new Response(null,{status:403});}
    try{
      const text=await request.text();if(text.length>2000)return new Response(null,{status:413});
      const input=z.object({sessionId:z.string().regex(/^session-[a-f0-9-]{36}$/),area:z.string().trim().min(2).max(120),placeId:z.string().max(140).optional()}).strict().parse(JSON.parse(text));
      const runtime=missionRuntime();if(!runtime.journal.session(input.sessionId))return new Response(null,{status:404});
      return Response.json({job:runtime.mapArea(input.sessionId,input.area,input.placeId)},{status:202});
    }catch(error){return Response.json({error:error instanceof Error?error.message:'The area map could not start.'},{status:409});}
  }
}}});
