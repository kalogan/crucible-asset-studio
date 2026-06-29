import "server-only";

/**
 * Intake auto-draft (INTAKE flow). Reads an art-bible text and asks Claude to
 * return a strict-JSON canon draft. Uses ephemeral prompt caching on the system
 * block (mirrors lib/executor/enrich.ts). Fails SOFT — if no key or the call
 * errors or the JSON is malformed, returns null so the page can offer hand-authoring.
 */
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";

const SYSTEM =
  "You are an art director. Read the art-bible text and return STRICT JSON only, " +
  "no prose, with keys prompt_prefix, prompt_suffix, negative_prompt, do_rules (array), " +
  "never_rules (array), palette_hexes (array of #hex). Mirror the doc's vocabulary.";

export interface DraftCanon {
  prompt_prefix: string;
  prompt_suffix: string;
  negative_prompt: string;
  do_rules: string[];
  never_rules: string[];
  palette_hexes: string[];
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export async function draftCanonFromText(text: string): Promise<DraftCanon | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

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
        max_tokens: 1200,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [
          { role: "user", content: `Art-bible text:\n\n${text}\n\nReturn the JSON.` },
        ],
      }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const raw = data.content?.[0]?.text;
    if (typeof raw !== "string" || !raw.trim()) return null;

    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return {
      prompt_prefix: typeof parsed.prompt_prefix === "string" ? parsed.prompt_prefix : "",
      prompt_suffix: typeof parsed.prompt_suffix === "string" ? parsed.prompt_suffix : "",
      negative_prompt:
        typeof parsed.negative_prompt === "string" ? parsed.negative_prompt : "",
      do_rules: asStringArray(parsed.do_rules),
      never_rules: asStringArray(parsed.never_rules),
      palette_hexes: asStringArray(parsed.palette_hexes),
    };
  } catch {
    return null;
  }
}
