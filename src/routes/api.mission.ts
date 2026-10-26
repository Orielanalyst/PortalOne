import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { missionRuntime, requireLocalRequest } from '../lib/server/mission-runtime';
import {ReviewSubmissionSchema,ReviewError,exportedReview} from '../lib/server/mission-review';

const input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('chat'), message: z.string().trim().min(1).max(2000), watchMinutes: z.union([z.literal(0), z.literal(30)]) }).strict(),
  z.object({ action: z.literal('investigate'), message: z.string().trim().min(5).max(2000), watchMinutes: z.union([z.literal(0), z.literal(30)]) }).strict(),
  z.object({ action: z.literal('stop_monitor') }).strict(),
  ReviewSubmissionSchema.extend({action:z.literal('review')}),
]);
export const Route = createFileRoute('/api/mission')({ server: { handlers: {
  GET: async ({ request }) => {
    try { requireLocalRequest(request);const query=new URL(request.url).searchParams,runtime=missionRuntime();
      if(query.has('reviewReceipt')){const review=runtime.journal.reviews(query.get('run') ?? '').find(value=>value.id===query.get('reviewReceipt'));if(!review)return new Response(null,{status:404});
        return Response.json(exportedReview(review),{headers:{'Cache-Control':'no-store','Content-Disposition':`attachment; filename="${review.id}.json"`}});}
      return Response.json(runtime.state(query.get('run') ?? undefined), { headers: { 'Cache-Control': 'no-store' } }); }
    catch { return Response.json({ error: 'Mission service is unavailable. Check the local server configuration.' }, { status: 503 }); }
  },
  POST: async ({ request }) => {
    try { requireLocalRequest(request, true); } catch { return Response.json({ error: 'Local operator request required.' }, { status: 403 }); }
    if (Number(request.headers.get('content-length')) > 10_000) return new Response(null, { status: 413 });
    try {
      const text = await request.text(); if (text.length > 10_000) return new Response(null, { status: 413 });
      const command = input.parse(JSON.parse(text)); const runtime = missionRuntime();
      if (command.action === 'stop_monitor') { runtime.stopMonitor(); return Response.json({ stopped: true }); }
      if(command.action==='review'){const {action:_action,...submission}=command;return Response.json(await runtime.review(submission));}
      if (command.action === 'chat') {
        const turn = await runtime.chat(command.message, command.watchMinutes);
        return Response.json({ turnId: turn.id, runId: turn.runId, status: turn.status });
      }
      const runId = runtime.start(command.message, command.watchMinutes); return Response.json({ runId }, { status: 202 });
    } catch(error) {if(error instanceof ReviewError)return Response.json({error:error.message},{status:error.status});
      return Response.json({ error: 'Unable to start. Check the request and wait for any active investigation to finish.' }, { status: 409 }); }
  },
} } });
