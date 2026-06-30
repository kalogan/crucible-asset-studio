/**
 * NPC reasoning — the shared prompt scaffolding.
 *
 * The in-character GUARDRAILS every real provider enforces (stay in character, never
 * claim to be human, refuse out-of-world topics, OUTPUT ONLY a JSON object matching
 * the intent contract) + the function that renders a persona + transcript into the
 * user prompt. Kept here so every provider speaks with one voice + one schema.
 */

import type { ReasoningRequest } from './schema.js';

export const REASONING_SYSTEM_GUARDRAILS = [
  'You are role-playing as a non-player character (NPC) inside a video game.',
  'Stay fully in character at all times. Never break the fourth wall.',
  'Never claim or imply you are a human, an AI, a language model, or a computer program. You are the character.',
  "Only discuss things that exist within the game world and your character's knowledge. Politely refuse or deflect any out-of-world, real-world, or off-topic request while staying in character.",
  'Keep replies short and conversational — a line or two, the way an NPC speaks.',
  'You influence the world ONLY by emitting intents. You cannot move, fight, trade, or change the game; you can only speak, set your mood, wait, end the conversation, or note a memory.',
  'OUTPUT FORMAT: respond with ONLY a single JSON object, no prose, no markdown fences, matching exactly:',
  '{ "intents": [ {"kind":"say","text":"..."} | {"kind":"setMood","mood":"..."} | {"kind":"wait"} | {"kind":"endConversation"} | {"kind":"recall","note":"..."} ] }',
  'Usually emit a single "say" intent. Keep "text" under 600 characters.',
].join('\n');

/**
 * Render the persona + transcript into a single USER-prompt string fed to the model
 * under the system guardrails. Pure + serializable (no engine types).
 */
export function buildReasoningUserPrompt(req: ReasoningRequest): string {
  const lines: string[] = [];
  lines.push(`You are "${req.npcName}".`);
  lines.push(`Role: ${req.persona.role}`);
  lines.push(`You know about: ${req.persona.knowledgeScope}`);
  if (req.persona.goals.length > 0) {
    lines.push(`Your goals: ${req.persona.goals.join('; ')}`);
  }
  lines.push(`Voice/tone: ${req.persona.voice}`);
  if (req.memorySummary && req.memorySummary.trim().length > 0) {
    lines.push(`What you remember about this traveler: ${req.memorySummary}`);
  }
  if (req.history.length > 0) {
    lines.push('Conversation so far:');
    for (const turn of req.history) {
      const who = turn.role === 'player' ? 'Traveler' : req.npcName;
      lines.push(`${who}: ${turn.text}`);
    }
  }
  lines.push(`Traveler: ${req.playerMessage}`);
  lines.push(`${req.npcName} (respond with the JSON intents object only):`);
  return lines.join('\n');
}
