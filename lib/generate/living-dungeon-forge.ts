/**
 * Living Dungeon "asset forge" 2D prompt pipeline — ported VERBATIM.
 *
 * The normal Crucible path enriches the SUBJECT form and then layers canon STYLE
 * on top (see lib/canon/prompt.ts). The Living Dungeon forge does the opposite: it
 * runs the description through Claude with a per-mode SYSTEM PROMPT that bakes in
 * the whole art bible, and sends Claude's output DIRECTLY to FLUX. To reproduce the
 * forge's look 1:1 we port its exact art bible + system prompts + mutations +
 * variants here, verbatim, and feed the enriched string straight to FLUX (bypassing
 * buildFinalPrompt) via the pipeline's `finalPromptOverride`.
 *
 * Pure data + string module: no "server-only", no network — safe to import anywhere
 * and unit-testable. The Anthropic call lives in the server action (buildForgePrompt).
 */

// ── Art bible (VERBATIM from the Living Dungeon forge) ───────────────────────
export interface ArtBible {
  theme: string;
  styleRules: string;
  colorSpec: string;
  forbidden: string;
  playerTheme: string;
}

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
  /** When true, the recipe is marked character-tpose so promote-to-3D keeps 0.88. */
  tpose: boolean;
}

export const POSES: Pose[] = [
  {
    id: "tpose",
    label: "T-pose reference (rig-ready)",
    poseLabel:
      "Full-body character reference, SINGLE isolated figure (not a sprite sheet, not a grid), front-facing symmetric T-pose with both arms extended out horizontally, legs apart, standing upright, full body head-to-toe, centered, for use as a 3D model reference",
    tpose: true,
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
 * Player user message. VERBATIM shape:
 *   `Sub-type: ${poseLabel}\nMutation: ${mutation.label} — ${mutation.desc}\n` +
 *   `Color variant: ${variant.label} — ${variant.desc}\n\nGenerate the image generation prompt.`
 */
export function buildPlayerUserMessage(input: {
  poseLabel: string;
  mutation: Mutation;
  variant: Variant;
}): string {
  const { poseLabel, mutation, variant } = input;
  return (
    `Sub-type: ${poseLabel}\n` +
    `Mutation: ${mutation.label} — ${mutation.desc}\n` +
    `Color variant: ${variant.label} — ${variant.desc}\n\n` +
    `Generate the image generation prompt.`
  );
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
  // player
  poseLabel?: string;
  mutation?: Mutation;
  variant?: Variant;
  // enemy
  label?: string;
  userDescription?: string;
}): string {
  const { mode, P } = input;
  if (mode === "player") {
    const mutation = input.mutation ?? DEFAULT_MUTATION;
    const variant = input.variant ?? DEFAULT_VARIANT;
    const pose = input.poseLabel ?? DEFAULT_POSE.poseLabel;
    return [
      "2D top-down pixel art, isolated sprite on pure black background",
      P.playerTheme,
      pose,
      `Mutation: ${mutation.desc}`,
      `Color variant: ${variant.desc}`,
      `Base colors: ${P.colorSpec}`,
      P.forbidden,
    ].join(". ");
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
