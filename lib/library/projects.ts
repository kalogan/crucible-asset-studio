/**
 * Pure sort helpers for the Project lists (Home dashboard + Creations page). Kept here
 * so the dashboard and Creations share one definition of "most recently updated".
 */
import type { Project } from "@/lib/schema";

/**
 * Newest GitHub activity first; projects with no `github_pushed_at` fall to the bottom
 * (tie-broken by the local record's `updated_at`). Identical to the dashboard ordering.
 */
export function compareByPushedAt(a: Project, b: Project): number {
  const ta = a.github_pushed_at ? Date.parse(a.github_pushed_at) : 0;
  const tb = b.github_pushed_at ? Date.parse(b.github_pushed_at) : 0;
  if (tb !== ta) return tb - ta;
  return Date.parse(b.updated_at) - Date.parse(a.updated_at);
}

/** Case-insensitive A–Z by display name. */
export function compareByName(a: Project, b: Project): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}
