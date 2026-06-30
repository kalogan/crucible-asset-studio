import "server-only";

import {
  generateDesignBrief,
  briefToScaffoldPicks,
  type BriefSystemRef,
  type DesignBrief,
  type ScaffoldPicks,
} from "game-kit/brief";
import { SYSTEMS } from "@/lib/kit/catalog";

/**
 * Design-brief generation — the Architect agent. Reuses game-kit's `brief` brain (schema +
 * persona + firewall) and injects a real Anthropic `complete` (Messages API, mirroring
 * lib/intake/draft.ts). Fails SOFT: no key / error / malformed JSON ⇒ null, so the page can
 * offer hand-authoring.
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";

/** An Anthropic-backed `complete(system, user) => text`. Throws on no-key / HTTP error. */
async function completeWithClaude(systemPrompt: string, userPrompt: string): Promise<string> {
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
      max_tokens: 1500,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);

  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  const raw = data.content?.[0]?.text;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error("Empty completion");
  }
  return raw;
}

/** The built kit systems offered to the architect (its `systems` will use these ids). */
function availableSystems(): BriefSystemRef[] {
  return SYSTEMS.filter((s) => s.status === "built").map((s) => ({ id: s.id, name: s.name }));
}

/** All built system ids (for filtering hallucinated picks). */
function builtSystemIds(): string[] {
  return SYSTEMS.filter((s) => s.status === "built").map((s) => s.id);
}

export interface BriefResult {
  brief: DesignBrief;
  picks: ScaffoldPicks;
}

/**
 * Generate a design brief for an idea, plus the scaffolder picks it maps to. Returns null on
 * any failure (no key, model error, unparseable reply).
 */
export async function generateBrief(
  idea: string,
  notes?: string,
): Promise<BriefResult | null> {
  const brief = await generateDesignBrief(completeWithClaude, {
    idea,
    availableSystems: availableSystems(),
    ...(notes ? { notes } : {}),
  });
  if (!brief) return null;
  const picks = briefToScaffoldPicks(brief, builtSystemIds());
  return { brief, picks };
}
