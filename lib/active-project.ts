import "server-only";
import { cookies, headers } from "next/headers";
import { getProject, getProjectBySlug } from "@/lib/db/projects";
import type { Project } from "@/lib/schema";

export const ACTIVE_PROJECT_COOKIE = "crucible.project";

export async function getActiveProjectId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_PROJECT_COOKIE)?.value ?? null;
}

/**
 * The active project. Under `/projects/[slug]/*` the middleware forwards the slug as
 * `x-active-project-slug`, so the URL wins (the workspace's project is unambiguous).
 * Elsewhere it falls back to the active-project cookie.
 */
export async function getActiveProject(): Promise<Project | null> {
  const slug = (await headers()).get("x-active-project-slug");
  if (slug) {
    const bySlug = await getProjectBySlug(slug);
    if (bySlug) return bySlug;
  }
  const id = await getActiveProjectId();
  if (!id) return null;
  return getProject(id);
}
