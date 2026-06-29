/**
 * Per-asset-type FRAMING — the FORMAT half of a prompt.
 *
 * The canon supplies STYLE (palette, look, mood); the asset type supplies FORMAT
 * (composition, framing) and format-specific "nevers". This separation fixes the
 * bug where a tilesheet-flavored canon (e.g. "no human faces", "seamlessly
 * tileable") fights a character portrait: those nevers belong to the *format*, not
 * the style, so they should travel with the asset type instead of the canon.
 *
 * `formatCues` is appended to the assembled prompt (see lib/canon/prompt.ts) and
 * `nevers` are merged into the canon's nevers — so a `character` framing carries an
 * empty `nevers` array and never inherits a "no faces" constraint.
 *
 * Pure data module: no "server-only", no React — safe to import anywhere.
 */

export type AssetTypeKey = "prop" | "tilesheet" | "character" | "sprite" | "icon" | "texture";

export interface Framing {
  key: AssetTypeKey;
  /** Human label for a dropdown, e.g. "Character / portrait". */
  label: string;
  /** Appended to the prompt — concrete composition/framing cues. */
  formatCues: string;
  /** Format-specific nevers, merged with the canon's nevers. Short. */
  nevers: string[];
}

export const ASSET_TYPE_FRAMINGS: Record<AssetTypeKey, Framing> = {
  prop: {
    key: "prop",
    label: "Prop / object",
    formatCues: "single isolated object, centered, neutral background, full object visible",
    nevers: ["multiple objects", "scene"],
  },
  tilesheet: {
    key: "tilesheet",
    label: "Tilesheet",
    formatCues:
      "seamless tilesheet, 4x4 grid of tiles, top-down orthographic, seamlessly tileable, repeating texture",
    nevers: ["single object", "characters", "faces"],
  },
  character: {
    key: "character",
    label: "Character / portrait",
    formatCues:
      "single centered character, front-facing, full figure or bust, clear readable silhouette",
    // Intentionally empty: characters need faces and must not inherit a "no faces" never.
    nevers: [],
  },
  sprite: {
    key: "sprite",
    label: "Sprite sheet",
    formatCues:
      "game sprite sheet, multiple poses in a grid, isolated on neutral background, top-down or side view",
    nevers: ["scene", "background clutter"],
  },
  icon: {
    key: "icon",
    label: "Icon",
    formatCues: "single centered icon, simple clear symbol, neutral background, small-size legible",
    nevers: ["scene", "background clutter"],
  },
  texture: {
    key: "texture",
    label: "Texture",
    formatCues: "seamless tileable texture, flat top-down, no objects, repeating surface detail",
    nevers: ["objects", "characters"],
  },
};

/** Dropdown options, in a sensible authoring order. */
export const ASSET_TYPE_OPTIONS: { key: AssetTypeKey; label: string }[] = [
  "prop",
  "character",
  "sprite",
  "icon",
  "tilesheet",
  "texture",
].map((key) => {
  const f = ASSET_TYPE_FRAMINGS[key as AssetTypeKey];
  return { key: f.key, label: f.label };
});

/**
 * Resolve a framing for an arbitrary string key, falling back to the `prop`
 * framing as a safe default for unknown/missing keys.
 */
export function framingFor(key: string): Framing {
  if (Object.prototype.hasOwnProperty.call(ASSET_TYPE_FRAMINGS, key)) {
    return ASSET_TYPE_FRAMINGS[key as AssetTypeKey];
  }
  return ASSET_TYPE_FRAMINGS.prop;
}
