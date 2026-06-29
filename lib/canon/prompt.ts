import type { Canon } from "@/lib/schema";

/** Pull hex strings out of a canon's style_guide.palette.hexes (defensively). */
function paletteHexes(styleGuide: Record<string, unknown>): string[] {
  const p = styleGuide.palette;
  if (!p || typeof p !== "object") return [];
  const hexes = (p as Record<string, unknown>).hexes;
  return Array.isArray(hexes) ? hexes.filter((x): x is string => typeof x === "string") : [];
}

/**
 * Assemble the final image prompt from a canon + the asset subject — the pre-LoRA
 * on-canon lever (KERNEL_LESSONS §0). Mirrors what made the March Living Dungeon
 * scaffolding work:
 *   - canon prefix supplies STYLE, the user supplies the SUBJECT, suffix adds framing
 *   - the palette hexes are repeated IN the prompt (the model gets exact colors)
 *   - FLUX-schnell has no negative field, so the canon's "nevers" are baked into the
 *     positive prompt as `no X` (the March trick)
 */
export function buildFinalPrompt(canon: Canon | null, subject: string): string {
  const clean = (s: string) => s.trim().replace(/^[,\s]+|[,\s]+$/g, "");
  const subj = clean(subject);
  if (!canon) {
    // Canon-free fallback.
    return `${subj}, isolated object, neutral background`;
  }

  const parts: string[] = [clean(canon.prompt_prefix), subj, clean(canon.prompt_suffix)];

  const hexes = paletteHexes(canon.style_guide).slice(0, 8);
  if (hexes.length) parts.push(`palette ${hexes.join(", ")}`);

  const nevers = canon.negative_prompt
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
  if (nevers.length) parts.push(nevers.map((n) => `no ${n}`).join(", "));

  return parts.filter((p) => p.length > 0).join(", ");
}
