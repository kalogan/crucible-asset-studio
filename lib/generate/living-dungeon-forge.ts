/**
 * Character forge — art-bible-driven 2D prompt pipeline (originally ported VERBATIM
 * from the Living Dungeon forge, now generalized to ANY project's canon).
 *
 * The normal Crucible path enriches the SUBJECT form and then layers canon STYLE
 * on top (see lib/canon/prompt.ts). The Character forge does the opposite: it runs
 * the description through Claude with a per-mode SYSTEM PROMPT that bakes in the
 * whole art bible, and sends Claude's output DIRECTLY to FLUX. The art bible is now
 * DERIVED from the active project's canon (`artBibleFromCanon`) so every game forges
 * rig-ready characters in its OWN style; the system prompts / user messages / poses /
 * fallback all stay verbatim and simply interpolate the canon-derived fields.
 *
 * Pure data + string module: no "server-only", no network — safe to import anywhere
 * and unit-testable. The Anthropic call lives in the server action (buildForgePrompt).
 */

import type { Canon } from "@/lib/schema";
import { paletteHexes } from "@/lib/canon/prompt";

// ── Art bible ────────────────────────────────────────────────────────────────
export interface ArtBible {
  theme: string;
  styleRules: string;
  colorSpec: string;
  forbidden: string;
  playerTheme: string;
}

/**
 * The Living Dungeon art bible (VERBATIM). Retained as the default / canon-free
 * fallback and as the golden fixture the tests pin against, but the live forge now
 * builds its art bible from the active project's canon via `artBibleFromCanon`.
 */
export const ART_BIBLE: ArtBible = {
  theme: "Interior of a living organism — flesh, membranes, veins, bioluminescence",
  styleRules:
    "2D top-down pixel art, 32×32 tiles, seamless tiling, biological horror aesthetic",
  colorSpec:
    "deep maroon #4e2329, flesh membrane #8a3a41, teal bioluminescence #4dbbc0, shadow purple #0a0a12",
  forbidden: "NO metal, NO stone, NO sci-fi tech, NO human faces, NO text",
  playerTheme:
    "Human host partially consumed by a living dungeon organism — biological horror aesthetic. Humanoid but with visible organic mutation overgrowth.",
};

// ── Canon → art bible ────────────────────────────────────────────────────────
/** Read a string off `style_guide[key]`, or "" if absent/non-string. */
function styleGuideString(styleGuide: Record<string, unknown>, key: string): string {
  const v = styleGuide[key];
  return typeof v === "string" ? v.trim() : "";
}

/** Render a comma-separated negative_prompt as "NO x, NO y, …". */
function forbiddenFromNegatives(negativePrompt: string): string {
  const terms = negativePrompt
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return terms.length ? terms.map((t) => `NO ${t}`).join(", ") : "";
}

/**
 * Map a project's canon → the forge's art-bible fields. Canon-DRIVEN so any game
 * forges in its own style:
 *   - `theme`       = style_guide.north_star
 *   - `colorSpec`   = the palette hexes (shared extractor, handles flat + grouped)
 *   - `forbidden`   = negative_prompt rendered as "NO x, NO y, …"
 *   - `playerTheme` = style_guide.character_theme, falling back to north_star +
 *                     "a humanoid character native to this world"
 * With no canon (or an empty one) we return the Living Dungeon `ART_BIBLE` so the
 * canon-free path still produces a coherent, on-look prompt. `styleRules` is not
 * canon-derived (the system prompts already fix "2D … pixel art on black") — it is
 * carried from the default bible unchanged.
 */
export function artBibleFromCanon(canon: Canon | null): ArtBible {
  if (!canon) return ART_BIBLE;
  const sg = canon.style_guide;
  const northStar = styleGuideString(sg, "north_star") || ART_BIBLE.theme;
  const hexes = paletteHexes(sg);
  const colorSpec = hexes.length ? hexes.join(", ") : ART_BIBLE.colorSpec;
  const forbidden = forbiddenFromNegatives(canon.negative_prompt) || ART_BIBLE.forbidden;
  const characterTheme = styleGuideString(sg, "character_theme");
  const playerTheme =
    characterTheme || `${northStar} — a humanoid character native to this world`;
  return {
    theme: northStar,
    styleRules: ART_BIBLE.styleRules,
    colorSpec,
    forbidden,
    playerTheme,
  };
}

// ── System prompts (VERBATIM template literals) ──────────────────────────────
/** Player-character sprite system prompt. Interpolates playerTheme/colorSpec/forbidden. */
export function buildSystemPlayer(P: ArtBible): string {
  return `You are an expert pixel art character designer for 2D games.
Generate a precise FLUX image generation prompt for a player character sprite.

Art Bible constraints — MUST enforce:
- Style: 2D top-down pixel art, isolated sprite(s) on pure black background
- Theme: ${P.playerTheme}
- Base colors: ${P.colorSpec}
- ${P.forbidden}

Respond with ONLY the image generation prompt. 80-150 words.`;
}

/** Enemy/creature sprite system prompt. Interpolates theme/colorSpec/forbidden. */
export function buildSystemEnemies(P: ArtBible): string {
  return `You are an expert game creature designer specializing in pixel art enemy sprites.
Transform the user's enemy description into a precise, optimized FLUX image generation prompt.

Art Bible constraints — MUST enforce:
- Style: 2D top-down pixel art, isolated sprite(s) on pure black background
- Theme: ${P.theme}
- Colors ONLY: ${P.colorSpec}
- Each sprite must be distinct and readable at small sizes
- ${P.forbidden}
- Sprites arranged in a clean grid, each cell isolated on black

Respond with ONLY the image generation prompt. 80-150 words, dense visual descriptors.`;
}

// ── Player mutations (VERBATIM) ──────────────────────────────────────────────
export interface Mutation {
  id: string;
  label: string;
  desc: string;
}

export const PLAYER_MUTATIONS: Mutation[] = [
  {
    id: "none",
    label: "None",
    desc: "Clean base form — minimal organic overgrowth, subtle vein tracery only",
  },
  {
    id: "membrane-wings",
    label: "Membrane wings",
    desc: "Translucent bioluminescent wing membranes extend from shoulder blades, ribbed with veins",
  },
  {
    id: "bone-spurs",
    label: "Bone spurs",
    desc: "Calcified bone protrusions erupt from forearms and spine, marrow-teal glow at fracture points",
  },
  {
    id: "neural-tendrils",
    label: "Neural tendrils",
    desc: "Thick neural tendrils extend from the skull and upper back, tips pulsing with electric teal light",
  },
];

// ── Player color variants (VERBATIM, accents kept) ───────────────────────────
export interface Variant {
  id: string;
  label: string;
  desc: string;
  accent: string;
}

export const PLAYER_VARIANTS: Variant[] = [
  {
    id: "base",
    label: "Base",
    desc: "Standard — deep maroon #4e2329 organic overgrowth, teal #4dbbc0 bioluminescence",
    accent: "#4dbbc0",
  },
  {
    id: "infected",
    label: "Infected",
    desc: "Deep infection stage — crimson #8a1a2a overgrowth, sickly amber #d4a020 glow, necrotic purple veins",
    accent: "#d4a020",
  },
  {
    id: "purified",
    label: "Purified",
    desc: "Cleansed by the organism — pale ivory #d4c8a8 membrane, crystal blue #60c8e0 luminescence, near-transcendent",
    accent: "#60c8e0",
  },
];

// ── GYRE forms (optional per-project variant set) ────────────────────────────
/**
 * GYRE's small character sub-type set — the caught souls of the Coil (DESIGN.md).
 * These play the same UI role as LD's "color variant" (a labelled descriptor line
 * appended to the user message), but describe FORM, not palette. GYRE ships no
 * mutation set (its `mutations` is empty → the forge shows only Mode + Pose + form).
 */
export const GYRE_FORMS: Variant[] = [
  {
    id: "unspooled",
    label: "Unspooled",
    desc: "The player-kind — hollowed at the Still Point, countercurrent; a spare faceted figure that stopped spiralling, neither living nor spirit",
    accent: "#cdd6e6",
  },
  {
    id: "hollow",
    label: "Hollow",
    desc: "Still partly itself — a caught soul reshaped by the Gyre that can be spoken to; faceted, cold-lit, watchful in the fog",
    accent: "#3a4a66",
  },
  {
    id: "warden",
    label: "Warden",
    desc: "Bound to guard a room or a Will — hostile, mostly silent; a starker, heavier faceted effigy made of the pull",
    accent: "#151a2b",
  },
];

// ── Per-project forge options (mutations/variants are OPTIONAL) ───────────────
/**
 * The Character forge's optional sub-type selectors, keyed by project slug. LD keeps
 * its exact mutations + color variants; GYRE contributes a small FORM set and no
 * mutations. Any project without an entry gets empty arrays → the form renders only
 * Mode + Pose + Description (no mutation/variant selectors).
 */
export interface ForgeOptions {
  mutations: Mutation[];
  variants: Variant[];
}

const PROJECT_FORGE_OPTIONS: Record<string, ForgeOptions> = {
  "living-dungeon": { mutations: PLAYER_MUTATIONS, variants: PLAYER_VARIANTS },
  gyre: { mutations: [], variants: GYRE_FORMS },
};

/** Resolve a project's optional mutation/variant sets (empty for unknown slugs). */
export function forgeOptionsForProject(slug: string | null | undefined): ForgeOptions {
  return (slug && PROJECT_FORGE_OPTIONS[slug]) || { mutations: [], variants: [] };
}

/** Lookup a mutation within a specific option set (falls back to a clean "none"). */
export function mutationInOptions(options: ForgeOptions, id: string): Mutation | null {
  if (options.mutations.length === 0) return null;
  return options.mutations.find((m) => m.id === id) ?? options.mutations[0]!;
}

/** Lookup a variant within a specific option set (null when the project has none). */
export function variantInOptions(options: ForgeOptions, id: string): Variant | null {
  if (options.variants.length === 0) return null;
  return options.variants.find((v) => v.id === id) ?? options.variants[0]!;
}

// ── Poses ────────────────────────────────────────────────────────────────────
/**
 * KEY ADAPTATION for the 3D→rig goal. The forge's player sub-types are sprite-sheet
 * ANIMATIONS (idle/walk). For rigging we need a SINGLE full-body figure, not a sheet.
 * So expose the POSE as a single-figure reference and pass it as the `poseLabel`.
 * The system prompt still enforces the art bible (black bg, palette, forbidden,
 * biological-horror theme), so the STYLE matches the forge while the figure is
 * single + riggable.
 */
export interface Pose {
  id: string;
  /** UI label. */
  label: string;
  /** The verbatim `poseLabel` interpolated into the user message's "Sub-type:" line. */
  poseLabel: string;
  /**
   * When true, the pose is RIG-READY (single separable full-body figure) → the recipe
   * is marked with a `character-*pose` framing key so promote-to-3D keeps the geometry
   * budget high. `rigReadyKey` says WHICH framing (A-pose is the recommended default).
   */
  tpose: boolean;
  /** The framing key a rig-ready pose maps to (character-apose | character-tpose). */
  rigReadyKey?: "character-apose" | "character-tpose";
}

export const POSES: Pose[] = [
  {
    // RECOMMENDED default: an A-pose rigs AND rest-deforms slightly better than a
    // strict T-pose (the shoulder sits at ~40° not a hard 90°, so skin weights relax
    // more naturally) while keeping arms just as separable from the torso.
    id: "apose",
    label: "A-pose reference (rig-ready, recommended)",
    poseLabel:
      "Full-body character reference, SINGLE isolated figure (not a sprite sheet, not a grid), front-facing symmetric natural A-pose with arms relaxed at roughly 40 degrees below horizontal away from the body, elbows slightly bent, hands open and clear of the torso, legs apart, standing upright, full body head-to-toe, centered, for use as a 3D model reference",
    tpose: true,
    rigReadyKey: "character-apose",
  },
  {
    id: "tpose",
    label: "T-pose reference (rig-ready)",
    poseLabel:
      "Full-body character reference, SINGLE isolated figure (not a sprite sheet, not a grid), front-facing symmetric T-pose with both arms extended out horizontally, legs apart, standing upright, full body head-to-toe, centered, for use as a 3D model reference",
    tpose: true,
    rigReadyKey: "character-tpose",
  },
  {
    id: "idle",
    label: "Idle portrait (single figure)",
    poseLabel:
      "Full-body character reference, SINGLE isolated figure (not a sprite sheet, not a grid), front-facing idle standing pose, arms relaxed at the sides, standing upright, full body head-to-toe, centered",
    tpose: false,
  },
];

export type ForgeMode = "player" | "enemy";

/** Non-empty defaults (the arrays above are const & non-empty; keeps noUncheckedIndexedAccess happy). */
export const DEFAULT_MUTATION: Mutation = PLAYER_MUTATIONS[0]!;
export const DEFAULT_VARIANT: Variant = PLAYER_VARIANTS[0]!;
export const DEFAULT_POSE: Pose = POSES[0]!;

export function mutationById(id: string): Mutation {
  return PLAYER_MUTATIONS.find((m) => m.id === id) ?? DEFAULT_MUTATION;
}

export function variantById(id: string): Variant {
  return PLAYER_VARIANTS.find((v) => v.id === id) ?? DEFAULT_VARIANT;
}

export function poseById(id: string): Pose {
  return POSES.find((p) => p.id === id) ?? DEFAULT_POSE;
}

// ── User messages (VERBATIM shapes) ──────────────────────────────────────────
/**
 * Player user message. VERBATIM shape when both a mutation AND a variant are present
 * (the Living Dungeon case):
 *   `Sub-type: ${poseLabel}\nMutation: ${mutation.label} — ${mutation.desc}\n` +
 *   `Color variant: ${variant.label} — ${variant.desc}\n\nGenerate the image generation prompt.`
 * A project without a mutation set (e.g. GYRE) passes `mutation: null` and that line
 * is simply omitted; likewise for a project with no variants. The remaining lines
 * keep their exact wording so LD's enriched prompt is unchanged.
 */
export function buildPlayerUserMessage(input: {
  poseLabel: string;
  mutation: Mutation | null;
  variant: Variant | null;
}): string {
  const { poseLabel, mutation, variant } = input;
  const lines = [`Sub-type: ${poseLabel}`];
  if (mutation) lines.push(`Mutation: ${mutation.label} — ${mutation.desc}`);
  if (variant) lines.push(`Color variant: ${variant.label} — ${variant.desc}`);
  return `${lines.join("\n")}\n\nGenerate the image generation prompt.`;
}

/**
 * Enemy user message. VERBATIM shape:
 *   `Asset: ${label}\nPrompt: ${userDescription}\n\nGenerate the optimized image generation prompt.`
 */
export function buildEnemyUserMessage(input: {
  label: string;
  userDescription: string;
}): string {
  return (
    `Asset: ${input.label}\n` +
    `Prompt: ${input.userDescription}\n\n` +
    `Generate the optimized image generation prompt.`
  );
}

// ── Fail-soft deterministic fallback ─────────────────────────────────────────
/**
 * When no ANTHROPIC_API_KEY is present (or the enrichment call errors), we still
 * need a FLUX prompt that carries the forge look. Assemble one deterministically
 * from the art bible so it contains theme + palette + forbidden + pose. This never
 * calls the network and is fully unit-testable.
 */
export function assembleFallbackPrompt(input: {
  mode: ForgeMode;
  P: ArtBible;
  // player — mutation/variant are optional; a project without them omits those lines.
  poseLabel?: string;
  mutation?: Mutation | null;
  variant?: Variant | null;
  // enemy
  label?: string;
  userDescription?: string;
}): string {
  const { mode, P } = input;
  if (mode === "player") {
    const pose = input.poseLabel ?? DEFAULT_POSE.poseLabel;
    const parts = [
      "2D top-down pixel art, isolated sprite on pure black background",
      P.playerTheme,
      pose,
    ];
    if (input.mutation) parts.push(`Mutation: ${input.mutation.desc}`);
    if (input.variant) parts.push(`Color variant: ${input.variant.desc}`);
    parts.push(`Base colors: ${P.colorSpec}`, P.forbidden);
    return parts.join(". ");
  }
  // enemy
  const label = input.label ?? "enemy";
  const desc = input.userDescription ?? "";
  return [
    "2D top-down pixel art, isolated sprite(s) on pure black background, clean grid, each cell isolated on black",
    `Theme: ${P.theme}`,
    `${label}${desc ? ` — ${desc}` : ""}`,
    `Colors ONLY: ${P.colorSpec}`,
    P.forbidden,
  ].join(". ");
}
