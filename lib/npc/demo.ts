import "server-only";

import {
  createNpcBrain,
  createBudgetedProvider,
  createInMemoryNpcStore,
  createHashingEmbedder,
  createExtractiveSummarizer,
  type NpcInfo,
  type NpcBrain,
  type ReasoningPersona,
} from "game-kit/npc";
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

// Process-singleton brain: an in-memory store + embedder (semantic recall) + summarizer.
// Memory persists for the life of the server process (resets on a cold serverless start).
let brain: NpcBrain | null = null;

export function getDemoBrain(): NpcBrain {
  if (!brain) {
    brain = createNpcBrain({
      provider: createBudgetedProvider(createCrucibleNpcProvider(), { perPlayerBudget: 20 }),
      store: createInMemoryNpcStore(),
      getNpcInfo: (id) => (id === MIRA_ID ? MIRA : undefined),
      embedder: createHashingEmbedder(),
      summarizer: createExtractiveSummarizer(),
    });
  }
  return brain;
}

const MIRA_ID = "mira";
