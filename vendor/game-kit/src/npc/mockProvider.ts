/**
 * NPC reasoning — the MOCK provider (deterministic, NO network).
 *
 * Returns a canned `say` intent, cycling through a small set so a conversation feels
 * alive without a backend. Used by tests, local dev, and as a cheap default. The same
 * request transcript always yields the same line — the index is derived from the
 * conversation length, never from a clock or RNG.
 */

import { parseReasoningResponse } from './schema.js';
import type { ReasoningRequest, ReasoningResponse } from './schema.js';
import type { ReasoningProvider } from './provider.js';

const DEFAULT_LINES: readonly string[] = [
  'Well met, traveler. The trail has been quiet today.',
  'Mind the frost — it nips the young shoots something fierce.',
  'Stay a while. The kettle is nearly on.',
  'Aye, a few have passed this way. None so weary as you, mind.',
];

/**
 * Create a deterministic, network-free provider. `respond` cycles `lines` by the
 * number of turns already spoken; `complete` returns a fixed JSON decision so a
 * consumer that firewalls it gets a valid (not dropped) value.
 */
export function createMockProvider(
  lines: readonly string[] = DEFAULT_LINES,
): ReasoningProvider {
  return {
    name: 'mock',

    async respond(req: ReasoningRequest): Promise<ReasoningResponse> {
      const idx = lines.length === 0 ? 0 : req.history.length % lines.length;
      const text = lines[idx] ?? 'Hm.';
      // Run through the firewall like a real provider would (identical contract).
      return { intents: parseReasoningResponse({ intents: [{ kind: 'say', text }] }) };
    },

    async complete(): Promise<string> {
      return JSON.stringify({ kind: 'report', note: 'mock-decision' });
    },
  };
}
