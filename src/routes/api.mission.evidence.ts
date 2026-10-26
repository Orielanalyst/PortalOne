import { createFileRoute } from '@tanstack/react-router';
import { missionRuntime, requireLocalRequest } from '../lib/server/mission-runtime';
export const Route = createFileRoute('/api/mission/evidence')({ server: { handlers: {
  GET: async ({ request }) => {
    try {
      requireLocalRequest(request); const query = new URL(request.url).searchParams;
      const journal=missionRuntime().journal;
      const value = journal.citations(query.get('run') ?? '').find(item => item.id === query.get('id'));
      if(!value)return new Response(null,{status:404});
      const reading=value.kind==='interpretation' && query.get('support')==='1'
        ? journal.interpretations(value.runId).find(item=>item.id===value.recordId):undefined;
      return Response.json(reading?{...value,support:{status:reading.status,visibility:reading.visibility ?? value.supportVisibility,exampleId:reading.exampleId,sourceTextSha256:reading.textSha256,
        claims:reading.claims,noClaimReason:reading.noClaimReason,receipt:reading.receipt,reusedFrom:reading.reusedFrom,
        limitation:'Local operator inspection only. Private quotations and extracted place/time mentions are excluded from public documents, downloads and the shared evidence register. Model interpretation is not field verification.'}}:value,
        { headers: { 'Cache-Control': 'no-store' } });
    } catch { return new Response(null, { status: 503 }); }
  },
} } });
