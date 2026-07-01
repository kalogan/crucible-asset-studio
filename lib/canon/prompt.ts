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
export function buildFinalPrompt(
  canon: Canon | null,
  subject: string,
  extraNevers: string[] = [],
): string {
  const clean = (s: string) => s.trim().replace(/^[,\s]+|[,\s]+$/g, "");
  const subj = clean(subject);
  if (!canon) {
    // Canon-free fallback.
    return `${subj}, isolated object, neutral background`;
  }

  const parts: string[] = [clean(canon.prompt_prefix), subj, clean(canon.prompt_suffix)];

  const hexes = paletteHexes(canon.style_guide).slice(0, 8);
  if (hexes.length) parts.push(`palette ${hexes.join(", ")}`);

  // FLUX-schnell has no negative field — bake the canon's nevers + any
  // format-specific nevers (from the asset-type framing) into the positive prompt.
  const nevers = [
    ...canon.negative_prompt.split(","),
    ...extraNevers,
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 14);
  if (nevers.length) parts.push(nevers.map((n) => `no ${n}`).join(", "));

  return parts.filter((p) => p.length > 0).join(", ");
}

/** Read a light, single-sentence mood hint from style_guide.north_star (defensively). */
function northStarHint(styleGuide: Record<string, unknown>): string {
  const ns = styleGuide.north_star;
  if (typeof ns !== "string") return "";
  // Keep it LIGHT — first sentence only, so mood colours the character without
  // dragging in the format constraints ("top-down 32x32 tiles", etc.).
  const firstSentence = ns.split(/(?<=[.!?])\s/)[0]?.trim() ?? "";
  return firstSentence;
}

/**
 * T-pose CHARACTER prompt — a deliberately different assembly from buildFinalPrompt.
 *
 * The canon's prompt_prefix/prompt_suffix/negative_prompt encode a 2D pixel-art *format*
 * ("2D pixel art…", "game asset pixel art", negatives "3d render, photorealistic"), which
 * would fight a full-body 3D character and its clean img→3D promotion. So this path takes
 * ONLY the canon's STYLE — palette hexes + a light north_star mood hint — and wraps it in a
 * fixed 3D-character format, appending the T-pose framing cues and nevers. Enrichment of the
 * subject still happens upstream (generate2D → expandSubject).
 */
export function buildCharacterTposePrompt(
  canon: Canon | null,
  subject: string,
  extraNevers: string[] = [],
): string {
  const clean = (s: string) => s.trim().replace(/^[,\s]+|[,\s]+$/g, "");
  const subj = clean(subject);
  const wrapper = "full-body 3D game character, clean stylized sculpt, readable silhouette";

  const parts: string[] = [subj, wrapper];

  if (canon) {
    const hint = northStarHint(canon.style_guide);
    if (hint) parts.push(hint);
    const hexes = paletteHexes(canon.style_guide).slice(0, 8);
    if (hexes.length) parts.push(`palette ${hexes.join(", ")}`);
  }

  // FLUX-schnell has no negative field — bake the format nevers into the positive prompt.
  // Only the framing's nevers apply here; the canon's 2D negatives are intentionally dropped.
  const nevers = extraNevers
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 14);
  if (nevers.length) parts.push(nevers.map((n) => `no ${n}`).join(", "));

  return parts.filter((p) => p.length > 0).join(", ");
}
