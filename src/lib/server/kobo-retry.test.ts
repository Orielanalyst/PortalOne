// @vitest-environment node
import {KoboClient} from './kobo';
const record={_id:1,_uuid:'demo',report_mode:'demo',observed_at:'2026-10-25T06:00:00Z',place_name:'Bambili',category:'other',report_text:'DEMONSTRATION ONLY',source_relation:'direct'};
it('uses the retained retry library for one transient source read and announces it',async()=>{
  const request=vi.fn().mockResolvedValueOnce(new Response(null,{status:503})).mockResolvedValueOnce(Response.json({count:1,next:null,results:[record]})),notice=vi.fn();
  const source=new KoboClient({server:'https://kf.kobotoolbox.org',projectUid:'project123',token:'private-test-token',fetch:request as typeof fetch});
  const result=await source.snapshot(AbortSignal.timeout(5000),notice);
  expect(result.count).toBe(1);expect(request).toHaveBeenCalledTimes(2);expect(notice).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(notice.mock.calls)).not.toContain('private-test-token');
});
it('does not retry an authentication failure or a cancelled read',async()=>{
  const request=vi.fn(async()=>new Response(null,{status:401})),notice=vi.fn();
  const source=new KoboClient({server:'https://kf.kobotoolbox.org',projectUid:'project123',token:'test',fetch:request as typeof fetch});
  await expect(source.snapshot(undefined,notice)).rejects.toThrow('HTTP 401');expect(request).toHaveBeenCalledTimes(1);expect(notice).not.toHaveBeenCalled();
  const controller=new AbortController();controller.abort();await expect(source.snapshot(controller.signal,notice)).rejects.toThrow();expect(request).toHaveBeenCalledTimes(1);
});
