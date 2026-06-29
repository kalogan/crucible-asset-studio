"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createProject, getProject, getProjectBySlug } from "@/lib/db/projects";
import { parseCreateProjectForm } from "@/lib/projects/createInput";
import { ACTIVE_PROJECT_COOKIE } from "@/lib/active-project";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function setActiveCookie(projectId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function createProjectAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { name, slug } = parseCreateProjectForm(String(formData.get("name") ?? ""));
    if (await getProjectBySlug(slug)) {
      return { ok: false, error: `A project with slug "${slug}" already exists.` };
    }
    const project = await createProject({ name, slug });
    await setActiveCookie(project.id);
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create project.",
    };
  }
}

export async function setActiveProjectAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const id = String(formData.get("projectId") ?? "");
    const project = await getProject(id);
    if (!project) return { ok: false, error: "Unknown project." };
    await setActiveCookie(project.id);
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to switch project.",
    };
  }
}
