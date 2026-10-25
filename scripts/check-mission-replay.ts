// Separate process: never change the running application's mode or singleton.
process.env['RELIEFINTEL_MODE'] = 'offline-replay';
globalThis.fetch = (() => { throw new Error('HTTP is disabled in this replay check.'); }) as typeof fetch;
const { missionRuntime } = await import('../src/lib/server/mission-runtime');
const runtime = missionRuntime();
const id = runtime.start('Replay community intake and place grounding around Bambili.', 0);
const until = Date.now() + 3000;
while (runtime.journal.run(id)?.status === 'running' && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 10));
const state = runtime.state(id);
if (state.selected?.status !== 'complete' || state.selected.result?.demoReports !== 2 || state.mode !== 'offline-replay' ||
    state.events.some(e => e.kind === 'model_receipt') || state.monitorUntil) throw new Error('Mission replay did not satisfy its explicit offline contract.');
console.log(JSON.stringify({ mode: state.mode, reports: state.selected.result.demoReports, disposition: state.selected.result.disposition,
  specialistTasks: state.events.filter(e => e.kind === 'task_started').length, networkEnabled: false, modelCalls: 0 }));
runtime.journal.close();
