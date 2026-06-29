"use server";

import { redirect } from "next/navigation";
import { getActiveProject } from "@/lib/active-project";
import { runGenerationPipeline } from "@/lib/pipeline/generate";
import type { ActionResult } from "./projects";

export async function runGenerateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const active = await getActiveProject();
  if (!active) return { ok: false, error: "No active project — pick one first." };

  const title = String(formData.get("title") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (title.length < 2) return { ok: false, error: "Title is required." };
  if (prompt.length < 3) return { ok: false, error: "Prompt is required." };

  try {
    await runGenerationPipeline({
      projectId: active.id,
      projectSlug: active.slug,
      title,
      prompt,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Generation failed.",
    };
  }
  redirect("/review");
}
