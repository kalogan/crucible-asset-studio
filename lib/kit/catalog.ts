// Kit health-check seed dataset — the systems audit.
//
// This is a director-editable snapshot of which reusable game-kit systems exist
// and how they map onto the five games. It is hand-maintained (estimates), not
// computed from the codebases. Edit the tables below to keep the audit current.

export type Tier = "atom" | "system" | "kit";
export type SystemStatus = "built" | "planned";

export type KitSystem = {
  id: string;
  name: string;
  tier: Tier;
  status: SystemStatus;
  /** Game-kit folder this system lives in (or would live in). */
  module?: string;
};

export type GameEngine = "three-r3f" | "three-vanilla";

export type Game = {
  id: string;
  name: string;
  engine: GameEngine;
};

/**
 * Adoption status of a system within a game:
 * - `core` — the game already has its own implementation; the kit would
 *   unify/replace it (highest-leverage place to consolidate).
 * - `gap`  — not present, but a candidate the game could adopt (net-new).
 * - `na`   — not applicable to this game.
 */
export type Adoption = "core" | "gap" | "na";

// Column order is fixed: PM, WT, SB, CV, DD.
export const GAMES: readonly Game[] = [
  { id: "project-mmo", name: "Project MMO", engine: "three-r3f" },
  { id: "woodturning-studio", name: "Woodturning Studio", engine: "three-r3f" },
  { id: "storm-break-hockey", name: "Storm-Break Hockey", engine: "three-vanilla" },
  { id: "corrupted-veil", name: "Corrupted Veil", engine: "three-vanilla" },
  { id: "deceive-me-daddy", name: "Deceive Me Daddy", engine: "three-vanilla" },
] as const;

export const SYSTEMS: readonly KitSystem[] = [
  // BUILT
  { id: "prng", name: "PRNG", tier: "atom", status: "built", module: "prng" },
  { id: "settings", name: "Settings", tier: "system", status: "built", module: "settings" },
  { id: "scene-state", name: "Scene State", tier: "system", status: "built", module: "scene-state" },
  { id: "lighting", name: "Lighting", tier: "system", status: "built", module: "lighting" },
  { id: "postfx", name: "Post FX", tier: "system", status: "built", module: "postfx" },
  { id: "audio", name: "Audio", tier: "system", status: "built", module: "audio" },
  { id: "hud", name: "HUD", tier: "kit", status: "built", module: "hud" },
  { id: "anim", name: "Animation", tier: "system", status: "built", module: "anim" },
  { id: "geo", name: "Geometry", tier: "atom", status: "built", module: "geo" },
  { id: "palette", name: "Palette", tier: "atom", status: "built", module: "palette" },
  { id: "artkit", name: "Art Kit", tier: "kit", status: "built", module: "artkit" },
  { id: "input", name: "Input", tier: "system", status: "built", module: "input" },
  { id: "save", name: "Save", tier: "system", status: "built", module: "save" },
  { id: "math", name: "Math", tier: "atom", status: "built", module: "math" },
  { id: "render-bootstrap", name: "Render Bootstrap", tier: "system", status: "built", module: "render" },
  { id: "camera-rigs", name: "Camera Rigs", tier: "system", status: "built", module: "camera" },
  { id: "netcode", name: "Netcode", tier: "kit", status: "built", module: "net" },
  { id: "fx-particles", name: "FX Particles", tier: "system", status: "built", module: "fx" },
  { id: "skeletal-anim", name: "Skeletal Anim", tier: "system", status: "built", module: "clip" },
  { id: "deploy-presets", name: "Deploy Presets", tier: "kit", status: "built", module: "presets" },
  { id: "npc-reasoning", name: "NPC Reasoning", tier: "kit", status: "built", module: "npc" },
  { id: "nav", name: "Nav / Pathfinding", tier: "system", status: "built", module: "nav" },
  { id: "npc-behavior", name: "NPC Behavior", tier: "system", status: "built", module: "behavior" },
] as const;

/**
 * ADOPTION[systemId][gameId] — the audit matrix.
 * Rows follow column order PM, WT, SB, CV, DD.
 */
export const ADOPTION: Record<string, Record<string, Adoption>> = {
  prng: { "project-mmo": "core", "woodturning-studio": "gap", "storm-break-hockey": "gap", "corrupted-veil": "gap", "deceive-me-daddy": "core" },
  settings: { "project-mmo": "core", "woodturning-studio": "core", "storm-break-hockey": "core", "corrupted-veil": "core", "deceive-me-daddy": "core" },
  "scene-state": { "project-mmo": "core", "woodturning-studio": "core", "storm-break-hockey": "core", "corrupted-veil": "core", "deceive-me-daddy": "core" },
  lighting: { "project-mmo": "core", "woodturning-studio": "gap", "storm-break-hockey": "core", "corrupted-veil": "core", "deceive-me-daddy": "core" },
  postfx: { "project-mmo": "core", "woodturning-studio": "gap", "storm-break-hockey": "core", "corrupted-veil": "core", "deceive-me-daddy": "core" },
  audio: { "project-mmo": "core", "woodturning-studio": "core", "storm-break-hockey": "core", "corrupted-veil": "core", "deceive-me-daddy": "gap" },
  hud: { "project-mmo": "core", "woodturning-studio": "core", "storm-break-hockey": "core", "corrupted-veil": "core", "deceive-me-daddy": "core" },
  anim: { "project-mmo": "core", "woodturning-studio": "na", "storm-break-hockey": "core", "corrupted-veil": "core", "deceive-me-daddy": "na" },
  geo: { "project-mmo": "core", "woodturning-studio": "core", "storm-break-hockey": "core", "corrupted-veil": "core", "deceive-me-daddy": "gap" },
  palette: { "project-mmo": "core", "woodturning-studio": "gap", "storm-break-hockey": "core", "corrupted-veil": "core", "deceive-me-daddy": "gap" },
  artkit: { "project-mmo": "core", "woodturning-studio": "gap", "storm-break-hockey": "gap", "corrupted-veil": "core", "deceive-me-daddy": "na" },
  input: { "project-mmo": "core", "woodturning-studio": "core", "storm-break-hockey": "core", "corrupted-veil": "core", "deceive-me-daddy": "core" },
  save: { "project-mmo": "core", "woodturning-studio": "core", "storm-break-hockey": "na", "corrupted-veil": "core", "deceive-me-daddy": "na" },
  math: { "project-mmo": "core", "woodturning-studio": "core", "storm-break-hockey": "core", "corrupted-veil": "core", "deceive-me-daddy": "core" },
  "render-bootstrap": { "project-mmo": "na", "woodturning-studio": "na", "storm-break-hockey": "core", "corrupted-veil": "core", "deceive-me-daddy": "core" },
  "camera-rigs": { "project-mmo": "core", "woodturning-studio": "core", "storm-break-hockey": "core", "corrupted-veil": "core", "deceive-me-daddy": "core" },
  netcode: { "project-mmo": "core", "woodturning-studio": "gap", "storm-break-hockey": "core", "corrupted-veil": "na", "deceive-me-daddy": "core" },
  "fx-particles": { "project-mmo": "core", "woodturning-studio": "gap", "storm-break-hockey": "core", "corrupted-veil": "core", "deceive-me-daddy": "gap" },
  "skeletal-anim": { "project-mmo": "gap", "woodturning-studio": "core", "storm-break-hockey": "gap", "corrupted-veil": "gap", "deceive-me-daddy": "core" },
  "deploy-presets": { "project-mmo": "core", "woodturning-studio": "gap", "storm-break-hockey": "core", "corrupted-veil": "core", "deceive-me-daddy": "core" },
  // Wayfinders (project-mmo) shipped the Grok-backed conversational NPC brain; the
  // other games have no dialogue-NPC system today, so it's n/a to their current design.
  "npc-reasoning": { "project-mmo": "core", "woodturning-studio": "na", "storm-break-hockey": "na", "corrupted-veil": "na", "deceive-me-daddy": "na" },
  // Nav/pathfinding + NPC behavior were distilled from project-mmo's sim-core; the other
  // games don't drive autonomous grid NPCs, so n/a to their current design.
  nav: { "project-mmo": "core", "woodturning-studio": "na", "storm-break-hockey": "na", "corrupted-veil": "na", "deceive-me-daddy": "na" },
  "npc-behavior": { "project-mmo": "core", "woodturning-studio": "na", "storm-break-hockey": "na", "corrupted-veil": "na", "deceive-me-daddy": "na" },
};

/** Look up adoption for a (system, game) pair. Returns `na` if unmapped. */
export function adoptionFor(systemId: string, gameId: string): Adoption {
  const row = ADOPTION[systemId];
  if (!row) return "na";
  return row[gameId] ?? "na";
}
