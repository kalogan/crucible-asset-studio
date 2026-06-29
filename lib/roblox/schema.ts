import { z } from "zod";

/**
 * Engine-agnostic Roblox descriptor schema (mapped from dino-tracks).
 *
 * The web↔Roblox bridge speaks in *descriptors*, not engine objects:
 *   - An ARCHETYPE defines named SOCKETS, each a CFrame + Size in the source
 *     engine. v1 reduces the CFrame to a position (no rotation/orientation yet).
 *   - A DESCRIPTOR's DNA maps socket-name → part-name (future: which mesh to
 *     load into each socket), plus a greybox color and a uniform size scale.
 *
 * Units are Roblox studs throughout (converted to metres at render time —
 * see lib/roblox/convert.ts). Mirrors the Zod-row style in lib/schema/index.ts.
 */

/** A `[x, y, z]` triple of studs. */
const vec3 = z.tuple([z.number(), z.number(), z.number()]);

/** One named socket of an archetype: where (position) + how big (size), in studs. */
export const Socket = z.object({
  position: vec3,
  size: vec3,
});
export type Socket = z.infer<typeof Socket>;

/**
 * An archetype's full set of sockets, keyed by socket name (e.g. "Torso",
 * "Head"). A `record` so archetypes can declare any socket layout.
 */
export const SocketSchema = z.record(Socket);
export type SocketSchema = z.infer<typeof SocketSchema>;

/** `#rgb` / `#rrggbb` hex color (three.js Color accepts the string directly). */
const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "must be #rgb or #rrggbb hex");

/**
 * A concrete creature/object instance over an archetype's sockets.
 *   - `archetype` names which SocketSchema to render against.
 *   - `dna` maps socket-name → part-name (future part loading; unused in the
 *     greybox render).
 *   - `color` greyboxes every part; `scale` is a uniform multiplier on the
 *     whole assembled group.
 */
export const RobloxDescriptor = z.object({
  id: z.string().min(1),
  archetype: z.string().min(1),
  dna: z.record(z.string()).optional(),
  color: hexColor,
  scale: z.number().positive().default(1),
});
export type RobloxDescriptor = z.infer<typeof RobloxDescriptor>;
