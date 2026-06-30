import "server-only";

import {
  REASONING_SYSTEM_GUARDRAILS,
  buildReasoningUserPrompt,
  parseReasoningResponse,
  createMockProvider,
  type ReasoningProvider,
  type ReasoningRequest,
  type ReasoningResponse,
} from "game-kit/npc";

/**
 * A Crucible `ReasoningProvider` for the NPC demo: Claude-backed when ANTHROPIC_API_KEY is
 * set (mirrors lib/intake/draft.ts), else the kit's deterministic mock so the demo always
 * works offline. `respond` runs the reply through game-kit's `parseReasoningResponse` firewall.
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";

async function claudeComplete(
  system: string,
  user: string,
  signal?: AbortSignal,
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    }),
    signal: signal ?? null,
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return data.content?.[0]?.text ?? "";
}

export function createCrucibleNpcProvider(): ReasoningProvider {
  if (!process.env.ANTHROPIC_API_KEY) return createMockProvider();
  return {
    name: "claude",
    async respond(req: ReasoningRequest, signal?: AbortSignal): Promise<ReasoningResponse> {
      const text = await claudeComplete(
        REASONING_SYSTEM_GUARDRAILS,
        buildReasoningUserPrompt(req),
        signal,
      );
      return { intents: parseReasoningResponse(text) };
    },
    async complete(system: string, user: string, signal?: AbortSignal): Promise<string> {
      return claudeComplete(system, user, signal);
    },
  };
}
