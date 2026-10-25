import { mkdirSync, writeFileSync } from 'node:fs';
import { configuredKobo } from '../src/lib/server/kobo';
import { configuredNightshift } from '../src/lib/server/runtime-config';
import { CommunityMap } from '../src/lib/server/community-map';
import { MissionJournal } from '../src/lib/server/mission-journal';
import { NightshiftDispatcher, runMission } from '../src/lib/server/mission-coordinator';

const journal = new MissionJournal('.runtime/mission-smoke/journal.sqlite');
try {
  const source = configuredKobo(); const map = new CommunityMap();
  const run = journal.startRun('Investigate community signals around Bambili, show mapped context and identify what is missing before planning a delivery.', 'operator');
  const dispatcher = new NightshiftDispatcher(configuredNightshift(), receipt => journal.event(run.id, 'coordinator', 'model_receipt', receipt));
  const result = await runMission({ run, journal, dispatcher, map, readSource: signal => source.snapshot(signal) });
  const events = journal.events(run.id);
  const receipt = { capturedAt: new Date().toISOString(), runId: run.id, disposition: result.disposition,
    demoReports: result.demoReports, liveReports: result.liveReports,
    delegatedTasks: events.filter(e => e.kind === 'task_started').map(e => ({ actor: e.actor, taskId: e.taskId, parentTaskId: e.parentTaskId, goal: e.detail })),
    models: events.filter(e => e.kind === 'model_receipt').map(e => JSON.parse(e.detail)),
    groundedPlaceIds: result.placeIds, gaps: result.gaps,
    completed: journal.run(run.id)?.status === 'complete',
    note: 'Actual Kobo API, actual Nemotron through Nightshift, local OSM geography. Demonstration observation only; no field incident verified or dispatch authorized.' };
  mkdirSync('.runtime/mission-smoke', { recursive: true });
  writeFileSync('.runtime/mission-smoke/receipt.json', JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
  if (!receipt.completed || receipt.delegatedTasks.length !== 4 || !receipt.models.length) process.exitCode = 1;
} finally { journal.close(); }
