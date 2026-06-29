"use server";

import { draftCanonFromText, type DraftCanon } from "@/lib/intake/draft";

export interface DraftResult {
  ok: boolean;
  draft?: DraftCanon;
  error?: string;
}

export async function draftCanonAction(
  _prev: DraftResult | null,
  formData: FormData,
): Promise<DraftResult> {
  const text = String(formData.get("text") ?? "").trim();
  if (!text) {
    return { ok: false, error: "Paste some art-bible text first." };
  }

  const draft = await draftCanonFromText(text);
  if (!draft) {
    return {
      ok: false,
      error:
        "Auto-draft needs an ANTHROPIC_API_KEY in .env.local — or hand-author in the Canon panel.",
    };
  }

  return { ok: true, draft };
}
