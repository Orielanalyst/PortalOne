import { fireEvent,render } from '@testing-library/react';
import { PlanArtifacts,CommitteeReport } from './mission-artifacts';
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
it('downloads the newest retained layout edition while original exports remain registered',()=>{
  const view={selected:{id:'mission-test'},documents:[],reportBundle:{status:'ready',note:'Review draft',files:[{name:'report.pdf'},{name:'committee-pack.zip'},{name:'report-edition-2.pdf'},{name:'committee-pack-edition-2.zip'}]}} as unknown as MissionView;
  const {getByRole}=render(<CommitteeReport view={view}/>);
  expect(getByRole('link',{name:'Download committee PDF'})).toHaveAttribute('href','/api/mission/download?run=mission-test&file=report-edition-2.pdf');
  expect(getByRole('link',{name:'Download complete GIS pack'})).toHaveAttribute('href','/api/mission/download?run=mission-test&file=committee-pack-edition-2.zip');
});
it('labels superseded downloads as historical and opens the replacement only on user selection',()=>{
  const onSelectRun=vi.fn();
  const view={selected:{id:'mission-old'},documents:[],currency:{status:'superseded',reason:'Evidence changed.',replacementRunId:'mission-new',previousRunId:null},
    reportBundle:{status:'ready',files:[{name:'report.pdf'},{name:'committee-pack.zip'}]}} as unknown as MissionView;
  const {getByRole,queryByRole}=render(<CommitteeReport view={view} onSelectRun={onSelectRun}/>);
  expect(queryByRole('link',{name:'Download committee PDF'})).toBeNull();
  expect(getByRole('link',{name:'Download historical PDF'})).toHaveAttribute('href','/api/mission/download?run=mission-old&file=report.pdf&historical=1');
  expect(onSelectRun).not.toHaveBeenCalled();fireEvent.click(getByRole('button',{name:'Open replacement mission'}));expect(onSelectRun).toHaveBeenCalledWith('mission-new');
});
