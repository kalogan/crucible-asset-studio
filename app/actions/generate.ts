"use server";

import { redirect } from "next/navigation";
import { getActiveProject } from "@/lib/active-project";
import { runGenerationPipeline } from "@/lib/pipeline/generate";
import { countJobsSince, countActiveJobsSince } from "@/lib/db/jobs";
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
