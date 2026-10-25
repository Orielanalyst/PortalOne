// @vitest-environment node
import {CitationStream} from './citation-stream';
const citations=[{id:'E0123456789'},{id:'Eabcdef0123'}];
it('resolves split handles while streaming every ordinary text character without replay',()=>{
  const deltas:string[]=[],stream=new CitationStream(citations,text=>deltas.push(text));
  const raw='## Findings\n\nA cited observation [S1][S2].';
  for(const character of raw)stream.push(character);
  expect(deltas.length).toBeGreaterThan(20);expect(deltas.join('')).toBe('## Findings\n\nA cited observation [E0123456789][Eabcdef0123].');
  expect(stream.finish(raw)).toBe(deltas.join(''));expect(deltas.join('')).not.toContain('[S');
});
it('encodes previous drafts only against the current catalogue and rejects invented handles',()=>{
  const stream=new CitationStream(citations,()=>{});
  expect(stream.encode('Existing [E0123456789], old [E0000000000].')).toBe('Existing [S1], old [superseded source].');
  stream.push('Unresolved [S99].');expect(()=>stream.finish('Unresolved [S99].')).toThrow('unresolved');
});
it('refuses untranslated provider identifiers and a completion that differs from the actual stream',()=>{
  const stream=new CitationStream(citations,()=>{});stream.push('A statement [E0123456789].');
  expect(()=>stream.finish('A statement [E0123456789].')).toThrow('short source handles');
  const changed=new CitationStream(citations,()=>{});changed.push('First');expect(()=>changed.finish('Different')).toThrow('differ');
});
