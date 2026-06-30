/**
 * NPC reasoning — the SEAM CONTRACT + the FIREWALL.
 *
 * Ported from Wayfinders' reasoning seam (docs/DESIGN-reasoning-npcs.md §2). The
 * brain is event-driven, server-side, and NEVER authoritative: its ONLY channel
 * back into the game is a BOUNDED set of `NpcIntent`s the game may choose to apply.
 *
 * ★ THE FIREWALL IS `parseReasoningResponse`. Any model output — malformed JSON,
 * an oversized `text`, an unknown `kind`, a movement/combat/economy intent that
 * does not exist in the vocabulary — is DROPPED, not applied. A consumer that runs
 * each parsed intent can therefore only ever execute a vocabulary item this schema
 * explicitly allows.
 *
 * ★ THE VOCABULARY IS DELIBERATELY SMALL + SAFE: `say`, `setMood`, `wait`,
 * `endConversation`, `recall`. NO movement / combat / economy intents — adding one
 * is an explicit, reviewed widening of the firewall, never an accident of a clever
 * model reply.
 *
 * Engine-agnostic + serializable: plain Zod shapes, no three / colyseus / DB import.
 */

import { z } from 'zod';

export const REASONING_SCHEMA_VERSION = 1;

// Bounds — caps that keep a single reply small. These are part of the firewall:
// an oversized field FAILS validation and the offending intent is dropped.

/** Max characters for a spoken / `recall` line. */
export const MAX_INTENT_TEXT = 600;
/** Max characters for a mood token (a short label, not a paragraph). */
export const MAX_MOOD_LEN = 40;
/** Max intents acted on from a single response (defence in depth). */
export const MAX_INTENTS_PER_RESPONSE = 8;

// ── ReasoningRequest — the plain, serializable INPUT to a provider ───────────

/** One turn of the conversation transcript fed to the brain. */
export const ReasoningHistoryTurnSchema = z
  .object({
    role: z.enum(['player', 'npc']),
    text: z.string(),
  })
  .strict();
export type ReasoningHistoryTurn = z.infer<typeof ReasoningHistoryTurnSchema>;

/** The brain's character sheet — all plain strings the brain reads. */
export const ReasoningPersonaSchema = z
  .object({
    role: z.string(),
    knowledgeScope: z.string(),
    goals: z.array(z.string()).default([]),
    voice: z.string(),
  })
  .strict();
export type ReasoningPersona = z.infer<typeof ReasoningPersonaSchema>;

export const ReasoningRequestSchema = z
  .object({
    /** The NPC's display name (used in the system prompt + transcript framing). */
    npcName: z.string(),
    /** The NPC's character sheet (role / knowledge scope / goals / voice). */
    persona: ReasoningPersonaSchema,
    /** The latest player utterance the brain is responding to. */
    playerMessage: z.string(),
    /** The transcript so far (oldest → newest), excluding `playerMessage`. */
    history: z.array(ReasoningHistoryTurnSchema).default([]),
    /** An optional rolled-up memory summary ("what it remembers about you"). */
    memorySummary: z.string().optional(),
  })
  .strict();
export type ReasoningRequest = z.infer<typeof ReasoningRequestSchema>;

// ── NpcIntent — the BOUNDED set the brain may emit (the firewall vocabulary) ──

/** `say` — speak a line to the player (the common case). Length-capped. */
export const SayIntentSchema = z
  .object({
    kind: z.literal('say'),
    text: z.string().min(1).max(MAX_INTENT_TEXT),
  })
  .strict();

/** `setMood` — nudge the NPC's displayed mood (a short cosmetic label; advisory). */
export const SetMoodIntentSchema = z
  .object({
    kind: z.literal('setMood'),
    mood: z.string().min(1).max(MAX_MOOD_LEN),
  })
  .strict();

/** `wait` — the brain chooses to say/do nothing this turn (a deliberate beat). */
export const WaitIntentSchema = z.object({ kind: z.literal('wait') }).strict();

/** `endConversation` — the brain ends the exchange (sign-off handled by `say`). */
export const EndConversationIntentSchema = z
  .object({ kind: z.literal('endConversation') })
  .strict();

/** `recall` — store a memory note (episodic/relational). Length-capped. */
export const RecallIntentSchema = z
  .object({
    kind: z.literal('recall'),
    note: z.string().min(1).max(MAX_INTENT_TEXT),
  })
  .strict();

export const NpcIntentSchema = z.discriminatedUnion('kind', [
  SayIntentSchema,
  SetMoodIntentSchema,
  WaitIntentSchema,
  EndConversationIntentSchema,
  RecallIntentSchema,
]);
export type NpcIntent = z.infer<typeof NpcIntentSchema>;

/** The exact set of intent kinds the firewall admits (for tests + diagnostics). */
export const NPC_INTENT_KINDS = [
  'say',
  'setMood',
  'wait',
  'endConversation',
  'recall',
] as const;
export type NpcIntentKind = (typeof NPC_INTENT_KINDS)[number];

// ── ReasoningResponse — the provider's OUTPUT shape (the wire form) ──────────

export const ReasoningResponseSchema = z
  .object({ intents: z.array(NpcIntentSchema).default([]) })
  .strict();
export type ReasoningResponse = z.infer<typeof ReasoningResponseSchema>;

// ── THE FIREWALL — `parseReasoningResponse` ─────────────────────────────────

/**
 * Validate-and-drop: parse a raw provider reply into the list of LEGAL `NpcIntent`s.
 *
 * Accepts a JSON string (fenced ```json blocks tolerated) or an already-parsed value.
 * Drops anything that is not a legal intent (unknown `kind`, oversized text/mood,
 * extra fields, wrong types) — one bad intent never poisons the rest — and caps the
 * result at `MAX_INTENTS_PER_RESPONSE`. NEVER throws: garbage yields no intents, and
 * the consumer then falls back to scripted lines. This is the only thing standing
 * between a model and the game state.
 */
export function parseReasoningResponse(raw: unknown): NpcIntent[] {
  const candidates = extractIntentCandidates(raw);
  const out: NpcIntent[] = [];
  for (const candidate of candidates) {
    if (out.length >= MAX_INTENTS_PER_RESPONSE) break;
    const parsed = NpcIntentSchema.safeParse(candidate);
    if (parsed.success) out.push(parsed.data);
    // else: DROP it — an invalid intent never reaches the consumer.
  }
  return out;
}

/**
 * Pull candidate intent objects out of whatever the provider returned, without
 * trusting any of it. Tolerates a JSON string, a fenced block, a bare array, or a
 * `{ intents: [...] }` envelope. Returns `[]` on anything else.
 */
function extractIntentCandidates(raw: unknown): unknown[] {
  let value: unknown = raw;

  if (typeof value === 'string') {
    const text = stripCodeFence(value).trim();
    if (text.length === 0) return [];
    try {
      value = JSON.parse(text);
    } catch {
      return [];
    }
  }

  if (Array.isArray(value)) return value;

  if (
    value &&
    typeof value === 'object' &&
    Array.isArray((value as { intents?: unknown }).intents)
  ) {
    return (value as { intents: unknown[] }).intents;
  }

  return [];
}

/** Strip a leading ```json / ``` fence if the model wrapped its JSON in one. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  const withoutOpen = trimmed.replace(/^```[a-zA-Z]*\s*\n?/, '');
  return withoutOpen.replace(/\n?```\s*$/, '');
}
