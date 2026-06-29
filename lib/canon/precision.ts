import type { Canon } from "@/lib/schema";

/**
 * The precision bar (CANON_INTAKE.md §6), Phase-2 scope (no LoRA yet). A canon is
 * "ready" for scaffolded generation when it has concrete prompt scaffolding, a
 * palette, and do/never rules. The LoRA requirement is added with the LoRA slice.
 */
export interface CanonReadiness {
  ready: boolean;
  missing: string[];
}

function styleGuideArray(canon: Canon, key: string): unknown[] {
  const v = (canon.style_guide as Record<string, unknown>)[key];
  return Array.isArray(v) ? v : [];
}

function styleGuideHasPalette(canon: Canon): boolean {
  const p = (canon.style_guide as Record<string, unknown>).palette;
  return !!p && typeof p === "object" && Object.keys(p as object).length > 0;
}

export function canonReadiness(canon: Canon): CanonReadiness {
  const missing: string[] = [];
  if (canon.prompt_prefix.trim().length < 8) missing.push("prompt prefix (style cues)");
  if (canon.negative_prompt.trim().length < 4) missing.push("negative prompt");
  if (!styleGuideHasPalette(canon)) missing.push("palette (hex values)");
  if (styleGuideArray(canon, "do").length < 3) missing.push("≥3 'do' rules");
  if (styleGuideArray(canon, "never").length < 3) missing.push("≥3 'never' rules");
  return { ready: missing.length === 0, missing };
}
