import { render } from '@testing-library/react';
import { MissionMarkdown } from './mission-markdown';
it('renders incomplete emphasis and code fences without exposing raw Markdown delimiters',()=>{
  const {container,rerender}=render(<MissionMarkdown text={'## Findings\n\n**Current evidence'} streaming/>);
  expect(container.querySelector('h2')?.textContent).toBe('Findings');expect(container.querySelector('strong')?.textContent).toContain('Current evidence');
  expect(container.textContent).not.toContain('**');
  rerender(<MissionMarkdown text={'## Findings\n\n**Current evidence**\n\n```json\n{"status":"unverified"}'} streaming/>);
  expect(container.querySelector('pre code')?.textContent).toContain('unverified');expect(container.textContent).not.toContain('```');
});
it('renders GFM tables, lists and traceable evidence links while suppressing external images',()=>{
  const {container}=render(<MissionMarkdown runId="mission-test" text={'## Evidence\n\n- **Known** facility\n\n| Facility | Capacity |\n| --- | --- |\n| Clinic | Unknown |\n\nSource [E0123456789]\n\n![remote](https://example.invalid/image.png)'} streaming/>);
  expect(container.querySelector('table')).not.toBeNull();expect(container.querySelector('li strong')?.textContent).toBe('Known');
  expect(container.querySelector('a')?.getAttribute('href')).toContain('/api/mission/evidence?run=mission-test');expect(container.querySelector('img')).toBeNull();
});
it('renders a completed streaming table header before its separator arrives and withholds ambiguous pipe syntax',()=>{
  const prefix='## Completed section\n\nA stable paragraph.\n\n';
  const {container,rerender}=render(<MissionMarkdown text={prefix+'| Facility | Cap'} streaming/>);
  expect(container.textContent).not.toContain('|');
  rerender(<MissionMarkdown text={prefix+'| Facility | Capacity |'} streaming/>);
  expect(container.querySelector('table')).not.toBeNull();expect(container.querySelector('th')?.textContent).toBe('Facility');
  rerender(<MissionMarkdown text={prefix+'| Facility | Capacity |\n| --- | --- |\n| Clinic | Unknown'} streaming/>);
  expect(container.querySelector('td')?.textContent).toBe('Clinic');
});
