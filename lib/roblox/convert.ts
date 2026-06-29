/**
 * Unit conversions for the Roblox bridge. Roblox authors in *studs*; three.js
 * scenes here are in *metres*. One stud ≈ 0.28 m (Roblox's rough human-scale
 * convention: a 5-stud-tall character ≈ 1.4 m). Keep these pure + tiny.
 */

/** Metres per Roblox stud. */
export const STUDS_TO_M = 0.28;

/** Convert a scalar stud measurement to metres. */
export function studsToM(n: number): number {
  return n * STUDS_TO_M;
}

/** Convert a `[x, y, z]` stud vector to a `[x, y, z]` metre vector. */
export function vec3ToM([x, y, z]: readonly [number, number, number]): [number, number, number] {
  return [studsToM(x), studsToM(y), studsToM(z)];
}
