import { slugify } from "@/lib/util/slug";

/** Derive a catalog key from a human title (e.g. "Ticket Booth" -> "prop.ticket-booth"). */
export function catalogKeyFor(title: string): string {
  return `prop.${slugify(title)}`;
}

/**
 * Storage path for a generated artifact, project-scoped:
 *   "<project-slug>/<catalog-key>.<ext>"  e.g. "wayfinders/prop.ticket-booth.glb"
 */
export function buildStoragePath(
  projectSlug: string,
  catalogKey: string,
  ext: string,
): string {
  const safeKey = catalogKey.replace(/[^a-z0-9._-]/gi, "-");
  return `${projectSlug}/${safeKey}.${ext}`;
}

/** Safely read a string field from a recipe_snapshot jsonb blob. */
export function recipeString(
  recipe: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const v = recipe[key];
  return typeof v === "string" && v.length > 0 ? v : fallback;
}
