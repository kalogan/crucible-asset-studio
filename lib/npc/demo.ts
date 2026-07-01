import "server-only";

import {
  createNpcBrain,
  createBudgetedProvider,
  createInMemoryNpcStore,
  createHashingEmbedder,
  createExtractiveSummarizer,
  type Embedder,
  type NpcInfo,
  type NpcBrain,
  type ReasoningPersona,
} from "game-kit/npc";
// OPT-IN neural embedder (DEFAULT OFF). `createTransformersEmbedder` is itself fully lazy:
// it only `await import('@xenova/transformers')` on the first embed() call, so this static
// import pulls in NOTHING but the sub-entry's own code. That keeps `tsc --noEmit` GREEN and
// the default path zero-dep WITHOUT `@xenova/transformers` installed — the heavy optional
// peer dep is never resolved unless a caller flips the flag AND the NPC actually embeds.
import { createTransformersEmbedder } from "game-kit/npc-transformers";
import { createCrucibleNpcProvider } from "./provider";

/** The demo NPC — a personaed herbalist who remembers the traveler across a session. */
const MIRA: NpcInfo = {
  name: "Mira",
  persona: {
    role: "a weary herbalist tending a frost-bitten garden at the edge of Skyhold",
    knowledgeScope: "herbs, frost, the trails around Skyhold, travelers who pass through",
    goals: ["keep the garden alive through the cold", "learn what the traveler is seeking"],
    voice: "warm but tired; plainspoken, a touch wry",
  },
  fallbackLines: ["Mm. Cold out, isn't it? What brings you to my garden?"],
  retentionDays: 0,
};

export const DEMO_NPC: { id: string; name: string; persona: ReasoningPersona } = {
  id: "mira",
  name: MIRA.name,
  persona: MIRA.persona,
};

/**
 * Pick the demo's `Embedder` (the semantic-recall seam). DEFAULT: the zero-dep, deterministic
 * `createHashingEmbedder()` (lexical recall, no model, no download). OPT-IN: a REAL neural
 * embedder via transformers.js, selected ONLY when `NPC_EMBEDDER=transformers` is set.
 *
 * The opt-in stays SAFE to leave in the default build because `createTransformersEmbedder` is
 * lazy — constructing it here touches nothing; `@xenova/transformers` is only `await import`ed
 * on the first embed(). So with the flag UNSET (the default) this file behaves exactly as the
 * zero-dep path, and `tsc --noEmit` passes with the optional peer dep ABSENT.
 *
 * TO TURN ON neural recall (a deliberate ~25MB model dependency, the game's choice):
 *   1. pnpm add @xenova/transformers
 *   2. run the server with NPC_EMBEDDER=transformers
 * Anything else (unset, or any other value) keeps the hashing default.
 */
function createDemoEmbedder(): Embedder {
  if (process.env.NPC_EMBEDDER === "transformers") {
    // Neural path: all-MiniLM-L6-v2 (384-dim) via transformers.js. The dep is loaded lazily
    // on first embed() — see game-kit/npc-transformers. Requires `pnpm add @xenova/transformers`.
    return createTransformersEmbedder();
  }
  // Zero-dependency default: deterministic lexical feature-hashing. No model, no download.
  return createHashingEmbedder();
}

// Process-singleton brain: an in-memory store + embedder (semantic recall) + summarizer.
// Memory persists for the life of the server process (resets on a cold serverless start).
let brain: NpcBrain | null = null;

export function getDemoBrain(): NpcBrain {
  if (!brain) {
    brain = createNpcBrain({
      provider: createBudgetedProvider(createCrucibleNpcProvider(), { perPlayerBudget: 20 }),
      store: createInMemoryNpcStore(),
      getNpcInfo: (id) => (id === MIRA_ID ? MIRA : undefined),
      embedder: createDemoEmbedder(),
      summarizer: createExtractiveSummarizer(),
    });
  }
  return brain;
}

const MIRA_ID = "mira";
