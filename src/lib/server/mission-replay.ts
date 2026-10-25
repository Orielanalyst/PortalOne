import { readFileSync } from 'node:fs';
import { normalizeKobo } from './kobo';
import type { KoboSnapshot } from './kobo';
import type { MissionDispatcher } from './mission-coordinator';

/** Explicit fallback: no network, provider credentials, live-intake or LLM claim. */
export const replayCommunitySource = {
  origin: null,
  async snapshot(signal?: AbortSignal): Promise<KoboSnapshot> {
    signal?.throwIfAborted(); const checkedAt = new Date().toISOString();
    const records = (JSON.parse(readFileSync('data/kobo/replay-reports.json', 'utf8')) as unknown[])
      .map(raw => normalizeKobo(raw, 'offlineReplay', checkedAt));
    return { sourceId: 'offline-replay', checkedAt, count: records.length, records };
  },
};
export const replayDispatcher: MissionDispatcher = {
  async choose(context, signal) { signal.throwIfAborted(); return { task: context.allowed[0]!, detail: 'Offline replay: select the next required task deterministically.' }; },
};
