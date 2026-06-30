"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createProject, getProject, getProjectBySlug, updateProject } from "@/lib/db/projects";
import { parseCreateProjectForm } from "@/lib/projects/createInput";
import { ProjectStatus, ProjectKind } from "@/lib/schema";
import { uploadProjectScreenshot } from "@/lib/projects/screenshot";
import { ACTIVE_PROJECT_COOKIE } from "@/lib/active-project";
import { parseRepoUrl, mapRepoToProject } from "@/lib/github/repo";
import { fetchGithubRepo } from "@/lib/github/fetch";

function formStr(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v.length > 0 ? v : null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Import a game as a project straight from a GitHub repo URL (or owner/repo). Fetches the
 * repo's metadata + auto-fills name/description/url/repo, then creates the project. Public
 * repos work unauthenticated; private repos need GITHUB_TOKEN.
 */
export async function importProjectFromGithubAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ref = parseRepoUrl(String(formData.get("repoUrl") ?? ""));
  if (!ref) return { ok: false, error: "Enter a GitHub repo URL or owner/repo." };

  let slug = "";
  try {
    const meta = await fetchGithubRepo(ref.owner, ref.repo);
    const p = mapRepoToProject(meta);
    slug = p.slug;
    if (await getProjectBySlug(slug)) {
      return { ok: false, error: `A project with slug "${slug}" already exists.` };
    }
    await createProject({
      slug: p.slug,
      name: p.name,
      description: p.description,
      url: p.url,
      repo_url: p.repo_url,
      status: "prototype",
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Import failed." };
  }

  revalidatePath("/");
  redirect(`/projects/${slug}`);
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
  let slug = "";
  try {
    const parsed = parseCreateProjectForm(String(formData.get("name") ?? ""));
    slug = parsed.slug;
    if (await getProjectBySlug(slug)) {
      return { ok: false, error: `A project with slug "${slug}" already exists.` };
    }
    const status = ProjectStatus.safeParse(String(formData.get("status") ?? ""));
    const kind = ProjectKind.safeParse(String(formData.get("kind") ?? ""));
    const project = await createProject({
      name: parsed.name,
      slug,
      description: formStr(formData, "description"),
      url: formStr(formData, "url"),
      repo_url: formStr(formData, "repo_url"),
      screenshot: formStr(formData, "screenshot"),
      ...(status.success ? { status: status.data } : {}),
      ...(kind.success ? { kind: kind.data } : {}),
    });
    await setActiveCookie(project.id);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create project.",
    };
  }
  revalidatePath("/");
  redirect(`/projects/${slug}`);
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
    // NOTE: `screenshot` is intentionally NOT written here — it's owned by the screenshot
    // picker (uploadScreenshotAction / setScreenshotUrlAction). Saving the Overview must
    // never clobber a freshly-uploaded hero with a stale form value.
    await updateProject(id, {
      description: orNull("description"),
      url: orNull("url"),
      repo_url: orNull("repo_url"),
      ...(statusParsed.success ? { status: statusParsed.data } : {}),
    });
    revalidatePath("/");
    if (slug) revalidatePath(`/projects/${slug}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save." };
  }
}

/** Set the non-destructive hero focal point (0..1 each axis) — frames the card/hero. */
export async function setScreenshotFocalAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get("projectId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const x = Number(formData.get("focalX"));
  const y = Number(formData.get("focalY"));
  if (!id) return { ok: false, error: "Missing project." };
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { ok: false, error: "Invalid focal point." };
  }
  const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
  try {
    await updateProject(id, {
      screenshot_focal_x: clamp01(x),
      screenshot_focal_y: clamp01(y),
    });
    revalidatePath("/");
    if (slug) revalidatePath(`/projects/${slug}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to set focus." };
  }
}

/** Set the portfolio hero from a pasted image URL (the no-upload path). */
export async function setScreenshotUrlAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get("projectId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const url = String(formData.get("screenshotUrl") ?? "").trim();
  if (!id) return { ok: false, error: "Missing project." };
  if (!url) return { ok: false, error: "Paste an image URL first." };
  try {
    await updateProject(id, { screenshot: url });
    revalidatePath("/");
    if (slug) revalidatePath(`/projects/${slug}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to set image." };
  }
}

/** Upload a hero screenshot to Supabase and set it on the project (the easy URL path). */
export async function uploadScreenshotAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get("projectId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!id || !slug) return { ok: false, error: "Missing project." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image to upload." };
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const url = await uploadProjectScreenshot(slug, bytes, file.type || "image/png", Date.now());
    await updateProject(id, { screenshot: url });
    revalidatePath("/");
    revalidatePath(`/projects/${slug}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Upload failed." };
  }
}

const WORKSPACE_PATHS = new Set(["/generate", "/review", "/canon", "/prompts", "/library"]);

/** Set a game active, then enter its generation workspace. */
export async function openWorkspaceAction(formData: FormData): Promise<void> {
  const id = String(formData.get("projectId") ?? "");
  const target = String(formData.get("target") ?? "/generate");
  const dest = WORKSPACE_PATHS.has(target) ? target : "/generate";
  if (id) await setActiveCookie(id);
  redirect(dest);
}
