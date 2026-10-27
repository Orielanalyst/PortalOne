import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { missionRuntime, requireLocalRequest } from '../lib/server/mission-runtime';
import {ReviewSubmissionSchema,ReviewError,exportedReview} from '../lib/server/mission-review';

const input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('chat'), message: z.string().trim().min(1).max(2000), watchMinutes: z.union([z.literal(0), z.literal(30)]),sessionId:z.string().regex(/^session-[a-f0-9-]{36}$/).optional() }).strict(),
  z.object({ action: z.literal('investigate'), message: z.string().trim().min(5).max(2000), watchMinutes: z.union([z.literal(0), z.literal(30)]),sessionId:z.string().regex(/^session-[a-f0-9-]{36}$/).optional() }).strict(),
  z.object({action:z.literal('new_session')}).strict(),
  z.object({ action: z.literal('stop_monitor') }).strict(),
  z.object({action:z.literal('retry_export'),runId:z.string().regex(/^mission-[a-f0-9-]{36}$/),watchMinutes:z.union([z.literal(0),z.literal(30)])}).strict(),
  ReviewSubmissionSchema.extend({action:z.literal('review')}),
]);
export const Route = createFileRoute('/api/mission')({ server: { handlers: {
  GET: async ({ request }) => {
    try { requireLocalRequest(request);const query=new URL(request.url).searchParams,runtime=missionRuntime();
      if(query.has('reviewReceipt')){const review=runtime.journal.reviews(query.get('run') ?? '').find(value=>value.id===query.get('reviewReceipt'));if(!review)return new Response(null,{status:404});
        return Response.json(exportedReview(review),{headers:{'Cache-Control':'no-store','Content-Disposition':`attachment; filename="${review.id}.json"`}});}
      const sessionId=query.get('session'),runId=query.get('run'),run=runId?runtime.journal.run(runId):null;
      if(sessionId&&!runtime.journal.session(sessionId)||runId&&(!run||sessionId&&run.sessionId!==sessionId))return Response.json({error:'Mission conversation or run not found.'},{status:404});
      return Response.json(runtime.state(query.get('run') ?? undefined,query.get('session')??undefined), { headers: { 'Cache-Control': 'no-store' } }); }
    catch { return Response.json({ error: 'Mission service is unavailable. Check the local server configuration.' }, { status: 503 }); }
  },
  POST: async ({ request }) => {
    try { requireLocalRequest(request, true); } catch { return Response.json({ error: 'Local operator request required.' }, { status: 403 }); }
    if (Number(request.headers.get('content-length')) > 10_000) return new Response(null, { status: 413 });
    try {
      const text = await request.text(); if (text.length > 10_000) return new Response(null, { status: 413 });
      const command = input.parse(JSON.parse(text)); const runtime = missionRuntime();
      if('sessionId' in command&&command.sessionId&&!runtime.journal.session(command.sessionId))return Response.json({error:'Mission conversation not found.'},{status:404});
      if(command.action==='new_session')return Response.json({session:runtime.newSession()},{status:201});
      if (command.action === 'stop_monitor') { runtime.stopMonitor(); return Response.json({ stopped: true }); }
      if(command.action==='retry_export')return Response.json(await runtime.retryExport(command.runId,command.watchMinutes));
      if(command.action==='review'){const {action:_action,...submission}=command;return Response.json(await runtime.review(submission));}
      if (command.action === 'chat') {
        const turn = await runtime.chat(command.message, command.watchMinutes,command.sessionId);
        return Response.json({ turnId: turn.id, runId: turn.runId, status: turn.status });
      }
      const runId = runtime.start(command.message, command.watchMinutes,'operator',command.sessionId); return Response.json({ runId }, { status: 202 });
    } catch(error) {if(error instanceof ReviewError)return Response.json({error:error.message},{status:error.status});
      return Response.json({ error: 'Unable to start. Check the request and wait for any active investigation to finish.' }, { status: 409 }); }
  },
} } });
