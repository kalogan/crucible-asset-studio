import type { CanonInsert } from "@/lib/schema";
import { wayfindersCanon } from "./wayfinders";
import { livingDungeonCanon } from "./living-dungeon";
import { gyreCanon } from "./gyre";

/**
 * Canon seed templates, keyed by project slug. A project whose slug matches a key
 * can one-click seed a hand-authored canon (from that game's art bible) instead of
 * filling the form by hand.
 */
export const CANON_SEEDS: Record<string, (projectId: string) => CanonInsert> = {
  wayfinders: wayfindersCanon,
  "living-dungeon": livingDungeonCanon,
  gyre: gyreCanon,
};

export function seedForSlug(slug: string): ((projectId: string) => CanonInsert) | null {
  return CANON_SEEDS[slug] ?? null;
}
