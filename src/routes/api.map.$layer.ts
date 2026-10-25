import { createFileRoute } from '@tanstack/react-router';
import { missionRuntime, requireLocalRequest } from '../lib/server/mission-runtime';

export const Route = createFileRoute('/api/map/$layer')({ server: { handlers: {
  GET: async ({ request, params }) => {
    try {
      requireLocalRequest(request);
      if (!['roads', 'places', 'facilities'].includes(params.layer)) return new Response(null, { status: 404 });
      return Response.json(missionRuntime().map.layers[params.layer], { headers: { 'Cache-Control': 'private, max-age=3600' } });
    } catch { return Response.json({ error: 'Map is unavailable.' }, { status: 503 }); }
  },
} } });
