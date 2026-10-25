import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { missionRuntime, requireLocalRequest } from '../lib/server/mission-runtime';

const input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('chat'), message: z.string().trim().min(1).max(2000), watchMinutes: z.union([z.literal(0), z.literal(30)]) }).strict(),
  z.object({ action: z.literal('investigate'), message: z.string().trim().min(5).max(2000), watchMinutes: z.union([z.literal(0), z.literal(30)]) }).strict(),
  z.object({ action: z.literal('stop_monitor') }).strict(),
]);
export const Route = createFileRoute('/api/mission')({ server: { handlers: {
  GET: async ({ request }) => {
    try { requireLocalRequest(request); return Response.json(missionRuntime().state(new URL(request.url).searchParams.get('run') ?? undefined), { headers: { 'Cache-Control': 'no-store' } }); }
    catch { return Response.json({ error: 'Mission service is unavailable. Check the local server configuration.' }, { status: 503 }); }
  },
  POST: async ({ request }) => {
    try { requireLocalRequest(request, true); } catch { return Response.json({ error: 'Local operator request required.' }, { status: 403 }); }
    if (Number(request.headers.get('content-length')) > 10_000) return new Response(null, { status: 413 });
    try {
      const text = await request.text(); if (text.length > 10_000) return new Response(null, { status: 413 });
      const command = input.parse(JSON.parse(text)); const runtime = missionRuntime();
      if (command.action === 'stop_monitor') { runtime.stopMonitor(); return Response.json({ stopped: true }); }
      if (command.action === 'chat') {
        const turn = await runtime.chat(command.message, command.watchMinutes);
        return Response.json({ turnId: turn.id, runId: turn.runId, status: turn.status });
      }
      const runId = runtime.start(command.message, command.watchMinutes); return Response.json({ runId }, { status: 202 });
    } catch { return Response.json({ error: 'Unable to start. Check the request and wait for any active investigation to finish.' }, { status: 409 }); }
  },
} } });
