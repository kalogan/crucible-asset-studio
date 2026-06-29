import type { RobloxDescriptor, SocketSchema } from "./schema";

/**
 * Demo archetypes + descriptors for the Phase-1 greybox render. All positions
 * and sizes are in studs (converted to metres at render time). Scales are kept
 * modest (~1–1.5) — the renderer normalizes-to-fit anyway, so scale here is
 * just relative bulk between species.
 */

/** Bipedal archetype (raptor-like): upright torso, two legs, two short arms, tail. */
export const BIPED: SocketSchema = {
  Torso: { position: [0, 0, 0], size: [2, 1.5, 1] },
  Head: { position: [0, 2.4, 0.5], size: [1.2, 0.9, 1.6] },
  Neck: { position: [0, 1.4, 0.2], size: [0.7, 0.9, 0.7] },
  Tail: { position: [0, -0.3, -1.8], size: [0.5, 0.5, 2] },
  LegL: { position: [-0.6, -1.2, 0], size: [0.5, 1.6, 0.5] },
  LegR: { position: [0.6, -1.2, 0], size: [0.5, 1.6, 0.5] },
  ArmL: { position: [-1.0, 0.4, 0.3], size: [0.35, 1.0, 0.35] },
  ArmR: { position: [1.0, 0.4, 0.3], size: [0.35, 1.0, 0.35] },
};

/** Quadrupedal archetype (trike-like): horizontal torso, four legs, neck + head, tail. */
export const QUADRUPED: SocketSchema = {
  Torso: { position: [0, 0, 0], size: [2.2, 1.6, 3] },
  Neck: { position: [0, 0.6, 2], size: [0.9, 0.9, 1] },
  Head: { position: [0, 0.7, 3], size: [1.4, 1.1, 1.6] },
  Tail: { position: [0, 0.2, -2.4], size: [0.6, 0.6, 2.2] },
  LegFL: { position: [-0.9, -1.3, 1.1], size: [0.55, 1.8, 0.55] },
  LegFR: { position: [0.9, -1.3, 1.1], size: [0.55, 1.8, 0.55] },
  LegBL: { position: [-0.9, -1.3, -1.1], size: [0.55, 1.8, 0.55] },
  LegBR: { position: [0.9, -1.3, -1.1], size: [0.55, 1.8, 0.55] },
};

/** Three dino descriptors over the two archetypes. */
export const DESCRIPTORS: RobloxDescriptor[] = [
  { id: "raptor", archetype: "BIPED", color: "#C83232", scale: 1.2 },
  { id: "rex", archetype: "BIPED", color: "#8B3A3A", scale: 1.5 },
  { id: "trike", archetype: "QUADRUPED", color: "#4A7C59", scale: 1.3 },
];

/** Resolve an archetype name to its SocketSchema. */
export const ARCHETYPES: Record<string, SocketSchema> = {
  BIPED,
  QUADRUPED,
};
