import { createFileRoute } from '@tanstack/react-router';
import { missionRuntime, requireLocalRequest } from '../lib/server/mission-runtime';
export const Route = createFileRoute('/api/mission/evidence')({ server: { handlers: {
  GET: async ({ request }) => {
    try {
      requireLocalRequest(request); const query = new URL(request.url).searchParams;
      const value = missionRuntime().journal.citations(query.get('run') ?? '').find(item => item.id === query.get('id'));
      return value ? Response.json(value, { headers: { 'Cache-Control': 'no-store' } }) : new Response(null, { status: 404 });
    } catch { return new Response(null, { status: 503 }); }
  },
} } });
