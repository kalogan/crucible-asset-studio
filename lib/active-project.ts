import "server-only";
import { cookies } from "next/headers";
import { getProject } from "@/lib/db/projects";
import type { Project } from "@/lib/schema";

export const ACTIVE_PROJECT_COOKIE = "crucible.project";

export async function getActiveProjectId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_PROJECT_COOKIE)?.value ?? null;
}

export async function getActiveProject(): Promise<Project | null> {
  const id = await getActiveProjectId();
  if (!id) return null;
  return getProject(id);
}
