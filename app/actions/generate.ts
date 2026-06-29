"use server";

import { redirect } from "next/navigation";
import { getActiveProject } from "@/lib/active-project";
import { runGenerationPipeline, runImagePipeline } from "@/lib/pipeline/generate";
import { getCanonByProject } from "@/lib/db/canons";
import { canonReadiness } from "@/lib/canon/precision";
import {
  countJobsSince,
  countActiveJobsSince,
  getLatestGeneratingJob,
} from "@/lib/db/jobs";
import {
  getDailyCostCap,
  startOfUtcDayIso,
  wouldExceedCap,
  estimatedSpend,
  INFLIGHT_WINDOW_MS,
} from "@/lib/budget";
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

  // ── Canon precision gate: if a canon exists it must be ready (CANON_INTAKE §6).
  // No canon = canon-free generation is allowed (output won't be on-style).
  const canon = await getCanonByProject(active.id);
  if (canon) {
    const { ready, missing } = canonReadiness(canon);
    if (!ready) {
      return {
        ok: false,
        error: `Canon "${canon.name}" isn't ready — missing: ${missing.join(", ")}. Finish it in the Canon panel.`,
      };
    }
  }

  // ── Cost guardrails (before any spend) ──
  const now = new Date();
  const inflight = await countActiveJobsSince(
    new Date(now.getTime() - INFLIGHT_WINDOW_MS).toISOString(),
  );
  if (inflight > 0) {
    return {
      ok: false,
      error: "A generation is already running — wait for it to finish before starting another.",
    };
  }
  const jobsToday = await countJobsSince(startOfUtcDayIso(now));
  const cap = getDailyCostCap();
  if (wouldExceedCap(jobsToday, cap)) {
    return {
      ok: false,
      error: `Daily cost cap reached (~$${estimatedSpend(jobsToday).toFixed(2)} of $${cap.toFixed(2)}). Raise CRUCIBLE_DAILY_COST_CAP in .env.local to continue.`,
    };
  }

  const mode = String(formData.get("mode") ?? "image") === "model" ? "model" : "image";
  const run = mode === "model" ? runGenerationPipeline : runImagePipeline;
  const assetType = String(formData.get("assetType") ?? "prop");
  const provider =
    String(formData.get("provider") ?? "flux") === "nanobanana" ? "nanobanana" : "flux";

  try {
    await run({
      projectId: active.id,
      projectSlug: active.slug,
      title,
      prompt,
      assetType,
      provider,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Generation failed.",
    };
  }
  redirect("/review");
}

export interface GenerationStatus {
  phase: "image" | "cutout" | "model" | "saving";
  elapsedMs: number;
}

/** Polled by the form while a generation runs, to drive the live stage indicator. */
export async function getGenerationStatus(): Promise<GenerationStatus | null> {
  const job = await getLatestGeneratingJob();
  if (!job) return null;
  const phase = (job.phase ?? "image") as GenerationStatus["phase"];
  return { phase, elapsedMs: Date.now() - new Date(job.created_at).getTime() };
}
