"use server";

import { generateBrief, type BriefResult } from "@/lib/brief/generate";

export interface BriefActionState {
  ok: boolean;
  result?: BriefResult;
  error?: string;
}

/** Architect agent: turn a game idea into a structured, scaffoldable design brief. */
export async function generateBriefAction(
  _prev: BriefActionState | null,
  formData: FormData,
): Promise<BriefActionState> {
  const idea = String(formData.get("idea") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!idea) return { ok: false, error: "Describe your game idea first." };

  try {
    const result = await generateBrief(idea, notes || undefined);
    if (!result) {
      return {
        ok: false,
        error:
          "Couldn't generate a brief (check ANTHROPIC_API_KEY, or the model returned no usable JSON). Try again.",
      };
    }
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to generate." };
  }
}
