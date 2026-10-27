import { createFileRoute } from '@tanstack/react-router';
import { missionRuntime, requireLocalRequest } from '../lib/server/mission-runtime';

export const Route = createFileRoute('/api/mission/stream')({ server: { handlers: {
  GET: async ({ request }) => {
    try { requireLocalRequest(request); } catch { return new Response(null, { status: 403 }); }
    const runtime = missionRuntime(), query=new URL(request.url).searchParams,selected=query.get('run')??undefined,session=query.get('session')??undefined;
    let initial:ReturnType<typeof runtime.state>;
    try{initial=runtime.state(selected,session);}catch{return Response.json({error:'Mission conversation or run not found.'},{status:404});}
    const encoder = new TextEncoder(); let cleanup = () => {};
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        const send = (type: string, data: unknown) => { if (!closed) controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)); };
        let visibleDocuments=new Set(initial.documents.map(document=>document.id));
        const sendState=()=>{const state=runtime.state(selected,initial.session.id);visibleDocuments=new Set(state.documents.map(document=>document.id));send('state',state);};
        send('state', initial);
        const unsubscribe = runtime.journal.subscribe(change => {
          try { if (change.type === 'delta') {if(visibleDocuments.has(change.documentId))send('delta', change);} else sendState(); }
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
