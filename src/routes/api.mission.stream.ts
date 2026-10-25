import { createFileRoute } from '@tanstack/react-router';
import { missionRuntime, requireLocalRequest } from '../lib/server/mission-runtime';

export const Route = createFileRoute('/api/mission/stream')({ server: { handlers: {
  GET: async ({ request }) => {
    try { requireLocalRequest(request); } catch { return new Response(null, { status: 403 }); }
    const runtime = missionRuntime(), selected = new URL(request.url).searchParams.get('run') ?? undefined;
    const encoder = new TextEncoder(); let cleanup = () => {};
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        const send = (type: string, data: unknown) => { if (!closed) controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)); };
        send('state', runtime.state(selected));
        const unsubscribe = runtime.journal.subscribe(change => {
          try { if (change.type === 'delta') send('delta', change); else send('state', runtime.state(selected)); }
          catch { cleanup(); }
        });
        const heartbeat = setInterval(() => { try { if (!closed) controller.enqueue(encoder.encode(': connected\n\n')); } catch { cleanup(); } }, 15_000);
        heartbeat.unref?.();
        cleanup = () => { if (closed) return; closed = true; clearInterval(heartbeat); unsubscribe(); try { controller.close(); } catch {} };
        request.signal.addEventListener('abort', cleanup, { once: true });
      }, cancel() { cleanup(); },
    });
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' } });
  },
} } });
