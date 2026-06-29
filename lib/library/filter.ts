/**
 * Pure filtering/sorting for the asset library. Generic over the minimal shape the UI
 * needs, so it's unit-testable without React/three. The library grid + page consume these.
 */

export interface FacetedAsset {
  type: string;
  tags: string[];
  createdAt: string;
}

/**
 * The filterable facets for a set of assets: every asset `type` (prop/creature/biome/…)
 * PLUS every origin tag (e.g. "Skyhold"), deduped (type wins) and alphabetized. These are
 * the chips beside "All".
 */
export function buildFacets(items: readonly FacetedAsset[]): string[] {
  const types = new Set(items.map((i) => i.type));
  const tags = new Set<string>();
  for (const i of items) for (const t of i.tags) if (!types.has(t)) tags.add(t);
  return [...new Set([...types, ...tags])].sort();
}

/** An asset matches a chip when the chip is its type OR one of its origin tags. */
export function matchesFacet(item: FacetedAsset, facet: string): boolean {
  return facet === "all" || item.type === facet || item.tags.includes(facet);
}

/** Apply a facet filter ("all" → everything). */
export function filterByFacet<T extends FacetedAsset>(items: readonly T[], facet: string): T[] {
  return facet === "all" ? [...items] : items.filter((i) => matchesFacet(i, facet));
}

/** Newest-first (ISO `createdAt` desc). Stable for equal timestamps. */
export function sortByNewest<T extends FacetedAsset>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** Count of assets per type (for the header read-out, e.g. "12 prop · 8 creature"). */
export function countByType(items: readonly FacetedAsset[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const i of items) counts[i.type] = (counts[i.type] ?? 0) + 1;
  return counts;
}
