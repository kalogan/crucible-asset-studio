"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createProject, getProject, getProjectBySlug, updateProject } from "@/lib/db/projects";
import { parseCreateProjectForm } from "@/lib/projects/createInput";
import { ProjectStatus } from "@/lib/schema";
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

/** Portfolio-face edit (Overview). Never touches the generation face. */
export async function updateProjectAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get("projectId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!id) return { ok: false, error: "Missing project." };
  const orNull = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v.length > 0 ? v : null;
  };
  const statusParsed = ProjectStatus.safeParse(String(formData.get("status") ?? ""));
  try {
    await updateProject(id, {
      description: orNull("description"),
      url: orNull("url"),
      repo_url: orNull("repo_url"),
      screenshot: orNull("screenshot"),
      ...(statusParsed.success ? { status: statusParsed.data } : {}),
    });
    revalidatePath("/");
    if (slug) revalidatePath(`/projects/${slug}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save." };
  }
}

const WORKSPACE_PATHS = new Set(["/generate", "/review", "/canon", "/prompts"]);

/** Set a game active, then enter its generation workspace. */
export async function openWorkspaceAction(formData: FormData): Promise<void> {
  const id = String(formData.get("projectId") ?? "");
  const target = String(formData.get("target") ?? "/generate");
  const dest = WORKSPACE_PATHS.has(target) ? target : "/generate";
  if (id) await setActiveCookie(id);
  redirect(dest);
}
