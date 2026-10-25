import { fireEvent,render } from '@testing-library/react';
import { PlanArtifacts } from './mission-artifacts';
import type { MissionView } from '../lib/server/mission-runtime';
import type { MissionDocument } from '../lib/mission-artifacts';
it('keeps the draft being read selected when a revised plan arrives, then permits explicit switching',()=>{
  const plan=(id:string,version:number)=>({id,runId:'mission-test',kind:'plan',actor:'planner',title:`Plan v${version}`,version,status:'published',markdown:`## Version ${version}\n\nA reviewable draft.`,metadata:{}} as MissionDocument);
  const view=(documents:MissionDocument[])=>({selected:{id:'mission-test'},documents} as MissionView);
  const first=plan('first',1),second=plan('second',2);
  const {container,rerender,getByRole}=render(<PlanArtifacts view={view([first])}/>);
  const heading=container.querySelector('h2');
  rerender(<PlanArtifacts view={view([first,second])}/>);
  expect(container.querySelector('h2')).toBe(heading);
  expect(getByRole('button',{name:'Plan v1'})).toHaveAttribute('aria-pressed','true');
  fireEvent.click(getByRole('button',{name:'Plan v2'}));
  expect(container.querySelector('h2')?.textContent).toBe('Version 2');
});
