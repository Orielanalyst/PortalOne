// @vitest-environment node
import { MissionJournal } from './mission-journal';
import { MissionRuntime } from './mission-runtime';
import { NightshiftConversation } from './mission-conversation';
import type { ConversationContext, ConversationDecision, MissionConversation } from './mission-conversation';
import { MeterlessClient } from './meterless';
import { CommunityMap } from './community-map';
import { FixtureCommunityEvidence } from './community-evidence';
import { normalizeKobo } from './kobo';
import type { DispatchContext } from './mission-coordinator';

const receipt = { requestedMode: 'meterless/fast', responseModel: 'nvidia/test', durationMs: 4,
  usage: { prompt_tokens: 12, completion_tokens: 11, total_tokens: 23 } };
const snapshot = () => ({ sourceId: 'kobo:test', checkedAt: new Date().toISOString(), count: 1,
  records: [normalizeKobo({ _id: 1, _uuid: 'demo', report_mode: 'demo', observed_at: '2026-10-25T06:00:00Z',
    place_name: 'Bambili', category: 'other', report_text: 'Demonstration', source_relation: 'direct' }, 'test', new Date().toISOString())] });
const investigate: ConversationDecision = { action: 'investigate', reply: 'I’ll check the community evidence around Bambili.',
  mission: { area: 'Bambili', objective: 'Investigate community reports and missing delivery evidence.' } };
const reply = (text: string): ConversationDecision => ({ action: 'reply', reply: text, mission: null });
function setup(conversation?: MissionConversation) {
  const journal = new MissionJournal(':memory:');
  const source = { origin: null, snapshot: vi.fn(async () => snapshot()) };
  const dispatcher = { choose: vi.fn(async (context: DispatchContext) => ({ task: context.allowed[0]!, detail: 'Required evidence task.' })) };
  const runtime = new MissionRuntime({ journal, source, conversation, dispatcher,
    evidence: new FixtureCommunityEvidence(new CommunityMap()) });
  return { runtime, journal, source, dispatcher };
}

it('replies to a greeting through the model adapter without reading data, delegating or enabling a watch', async () => {
  const request = vi.fn(async () => new Response(`data: ${JSON.stringify({model:'nvidia/test',choices:[{delta:{content:JSON.stringify(reply('Hello! What area or mission would you like us to work on?'))},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`,{headers:{'content-type':'text/event-stream'}}));
  const client = new MeterlessClient({ baseUrl: 'localhost:8088', token: 'private-test-token', fetch: request as unknown as typeof fetch });
  const callbacks = vi.fn(); const { runtime, journal, source, dispatcher } = setup(new NightshiftConversation(client, callbacks));
  try {
    const turn = await runtime.chat('Hello', 30);
    expect(turn).toMatchObject({ status: 'replied', action: 'reply', runId: null, mode: 'live-model' });
    expect(turn.reply).toContain('What area'); expect(request).toHaveBeenCalledTimes(1);
    expect(callbacks).toHaveBeenCalledWith(expect.objectContaining({ responseModel: 'nvidia/test' }));
    const body = JSON.parse(String((request.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.max_tokens).toBe(256); expect(body.messages[0].content).not.toContain('private-test-token');
    expect(source.snapshot).not.toHaveBeenCalled(); expect(dispatcher.choose).not.toHaveBeenCalled();
    expect(runtime.state().runs).toHaveLength(0); expect(runtime.state().monitorUntil).toBeNull();
  } finally { runtime.stopMonitor(); journal.close(); }
});

it('retains clarifications, starts only an authorized investigation, summarizes it and grounds follow-up answers', async () => {
  const contexts: ConversationContext[] = [];
  const conversation: MissionConversation = {
    async respond(context) {
      contexts.push(context);
      return contexts.length === 1 ? reply('What area should we investigate?')
        : contexts.length === 2 ? reply('Bambili. Shall I investigate the community reports there?')
          : contexts.length === 3 ? investigate : reply('The resources are synthetic and expired, and the incident location is unconfirmed.');
    },
    summarize: vi.fn(async () => ({ reply: 'We found a demonstration report, but current field evidence is missing. What delivery are you preparing?', receipt })),
  };
  const { runtime, journal, source } = setup(conversation);
  try {
    await runtime.chat('I need help preparing relief work.', 0); await runtime.chat('Around Bambili.', 0);
    expect(source.snapshot).not.toHaveBeenCalled(); expect(journal.recent()).toHaveLength(0);
    const launch = await runtime.chat('Yes, please investigate those reports.', 0);
    expect(launch.action).toBe('investigate'); expect(launch.runId).toBeTruthy();
    await vi.waitFor(() => expect(runtime.state().activeRunId).toBeNull());
    expect(contexts[2]?.history.map(t => t.message)).toEqual(['I need help preparing relief work.', 'Around Bambili.']);
    expect(journal.recent()).toHaveLength(1); expect(journal.recent()[0]?.message).toContain('Area: Bambili');
    expect(conversation.summarize).toHaveBeenCalledTimes(1);
    expect(runtime.state().conversationSummaries[0]).toMatchObject({ status: 'complete', receipt, runId: launch.runId });
    const before = source.snapshot.mock.calls.length;
    await runtime.chat('Why are we holding?', 0);
    expect(source.snapshot).toHaveBeenCalledTimes(before); expect(journal.recent()).toHaveLength(1);
    expect(contexts[3]?.lastInvestigation?.gaps.join(' ')).toContain('expired');
    expect(contexts[3]?.history[2]?.reply).toContain('What delivery');
    expect(contexts[3]?.lastInvestigation?.planning?.status).toBe('checked');
  } finally { runtime.stopMonitor(); journal.close(); }
});

it.each(['unavailable', 'malformed'])('saves the message and exposes an honest failure when the conversation is %s', async failure => {
  const { runtime, journal, source, dispatcher } = setup({ async respond() {
    if (failure === 'unavailable') throw new Error('private provider payload');
    return { action: 'investigate', reply: 'Start', mission: { area: '', objective: '' } } as never;
  } });
  try {
    const turn = await runtime.chat('Help me', 30);
    expect(turn).toMatchObject({ status: 'failed', message: 'Help me', runId: null });
    expect(turn.reply).toContain('No investigation was started'); expect(JSON.stringify(turn)).not.toContain('private provider payload');
    expect(source.snapshot).not.toHaveBeenCalled(); expect(dispatcher.choose).not.toHaveBeenCalled();
    expect(runtime.state().monitorUntil).toBeNull();
  } finally { runtime.stopMonitor(); journal.close(); }
});

it('serializes conversational turns and prevents a direct investigation from racing a pending reply', async () => {
  let resolveReply: ((value: ConversationDecision) => void) | undefined;
  const { runtime, journal, source } = setup({ respond: () => new Promise(resolve => { resolveReply = resolve; }) });
  try {
    const pending = runtime.chat('Hi', 0);
    expect(runtime.state().chatBusy).toBe(true); expect(journal.conversation()[0]?.status).toBe('pending');
    await expect(runtime.chat('Another message', 0)).rejects.toThrow('already replying');
    expect(() => runtime.start('Investigate Bambili', 0)).toThrow('already working');
    resolveReply!(reply('What mission are we working on?')); await pending;
    expect(runtime.state().chatBusy).toBe(false); expect(source.snapshot).not.toHaveBeenCalled();
  } finally { runtime.stopMonitor(); journal.close(); }
});

it('preserves completed dialogue and marks pending replies interrupted on restart', () => {
  const { runtime, journal } = setup();
  try {
    const complete = journal.beginConversation('Hello', 'live-model');
    journal.conversationReceipt(complete.id, receipt); journal.finishConversation(complete.id, 'What mission?', 'reply');
    journal.beginConversation('We need help', 'live-model');
    const restarted = new MissionRuntime({ journal, source: { origin: null, snapshot: async () => snapshot() }, evidence: new FixtureCommunityEvidence(new CommunityMap()) });
    expect(restarted.state().conversation).toEqual([
      expect.objectContaining({ status: 'replied', message: 'Hello', receipt }),
      expect.objectContaining({ status: 'failed', message: 'We need help', reply: expect.stringContaining('restarted') }),
    ]);
    expect(restarted.state().runs).toHaveLength(0); expect(restarted.state().chatBusy).toBe(false);
  } finally { runtime.stopMonitor(); journal.close(); }
});

it('labels offline conversation explicitly and never calls a live provider', async () => {
  vi.stubEnv('RELIEFINTEL_MODE', 'offline-replay');
  const journal = new MissionJournal(':memory:');
  const runtime = new MissionRuntime({ journal });
  try {
    const turn = await runtime.chat('Hello', 0);
    expect(turn).toMatchObject({ mode: 'offline-replay', action: 'reply', runId: null, receipt: null });
    expect(turn.reply).toContain('no conversational model'); expect(journal.recent()).toHaveLength(0);
  } finally { runtime.stopMonitor(); journal.close(); vi.unstubAllEnvs(); }
});
