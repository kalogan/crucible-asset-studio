import type { Canon } from "@/lib/schema";

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Pull hex strings out of a canon's `style_guide.palette` (defensively).
 * Handles both shapes we author:
 *   - flat:    `{ palette: { hexes: ["#…", …] } }`  (Living Dungeon / GYRE)
 *   - grouped: `{ palette: { snow_cool: ["#…"], fire: ["#…"] } }`  (Wayfinders)
 * The flat `hexes` array wins when present; otherwise every hex-looking string in
 * the grouped values is collected (order preserved).
 */
export function paletteHexes(styleGuide: Record<string, unknown>): string[] {
  const p = styleGuide.palette;
  if (!p || typeof p !== "object") return [];
  const rec = p as Record<string, unknown>;
  const flat = rec.hexes;
  if (Array.isArray(flat)) {
    return flat.filter((x): x is string => typeof x === "string");
  }
  // Grouped palette — flatten every array/string value, keep hex-looking strings.
  const out: string[] = [];
  for (const v of Object.values(rec)) {
    if (typeof v === "string" && HEX_RE.test(v)) out.push(v);
    else if (Array.isArray(v)) {
      for (const x of v) if (typeof x === "string" && HEX_RE.test(x)) out.push(x);
    }
  }
  return out;
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

