import "server-only";

/**
 * Optional Claude prompt enrichment (KERNEL_LESSONS §7). Uses ephemeral prompt
 * caching on the system block. Fails SOFT — if no key or the call errors, the raw
 * prompt is returned unchanged, so generation never hard-depends on enrichment.
 * In Phase 1 the system prompt is generic; Phase 2 replaces it with canon scaffolding.
 */
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";

const DEFAULT_SYSTEM =
  "You are an expert prompt engineer for image-generation models (FLUX/SDXL). " +
  "Rewrite the user's asset description into one dense, concrete image prompt: " +
  "the subject, materials, form, and framing. Keep it an isolated object on a " +
  "neutral background unless told otherwise. Respond with ONLY the prompt, 40-120 words.";

export interface EnrichOptions {
  system?: string;
  model?: string;
  /** Cap output tokens (default 600). The Living Dungeon forge pins this to 400 for parity. */
  maxTokens?: number;
  /**
   * When set, this exact string is sent as the user message (no `Asset: …` wrapping).
   * The Living Dungeon forge composes its own verbatim user message and passes it here.
   */
  userMessage?: string;
}

export async function enrichPrompt(
  rawPrompt: string,
  opts: EnrichOptions = {},
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return rawPrompt;

  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const system = opts.system ?? DEFAULT_SYSTEM;
  const userContent = opts.userMessage ?? `Asset: ${rawPrompt}\n\nGenerate the prompt.`;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 600,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userContent }],
      }),
    });
    if (!res.ok) return rawPrompt;
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text;
    return typeof text === "string" && text.trim() ? text.trim() : rawPrompt;
  } catch {
    return rawPrompt;
  }
}
