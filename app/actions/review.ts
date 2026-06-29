"use server";

import { revalidatePath } from "next/cache";
import { updateAsset } from "@/lib/db/assets";
import { convertAssetTo3D } from "@/lib/pipeline/generate";
import { countJobsSince, countActiveJobsSince } from "@/lib/db/jobs";
import {
  getDailyCostCap,
  startOfUtcDayIso,
  wouldExceedCap,
  estimatedSpend,
  INFLIGHT_WINDOW_MS,
} from "@/lib/budget";
import type { ActionResult } from "./projects";

async function setStage(
  formData: FormData,
  stage: "approved" | "rejected",
): Promise<ActionResult> {
  const id = String(formData.get("assetId") ?? "");
  if (!id) return { ok: false, error: "Missing asset id." };
  try {
    await updateAsset(id, { stage });
    revalidatePath("/review");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Update failed.",
    };
  }
}

export async function approveAssetAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return setStage(formData, "approved");
}

export async function rejectAssetAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return setStage(formData, "rejected");
}

/** Promote a reviewed 2D image asset to 3D (the expensive TRELLIS step, on demand). */
export async function makeAsset3DAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get("assetId") ?? "");
  if (!id) return { ok: false, error: "Missing asset id." };

  // Same cost guardrails as generation (this spends ~$0.08 on TRELLIS).
  const now = new Date();
  const inflight = await countActiveJobsSince(
    new Date(now.getTime() - INFLIGHT_WINDOW_MS).toISOString(),
  );
  if (inflight > 0) {
    return { ok: false, error: "A generation is already running — wait for it to finish." };
  }
  const jobsToday = await countJobsSince(startOfUtcDayIso(now));
  const cap = getDailyCostCap();
  if (wouldExceedCap(jobsToday, cap)) {
    return {
      ok: false,
      error: `Daily cost cap reached (~$${estimatedSpend(jobsToday).toFixed(2)} of $${cap.toFixed(2)}). Raise CRUCIBLE_DAILY_COST_CAP to continue.`,
    };
  }

  try {
    await convertAssetTo3D(id);
    revalidatePath("/review");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "3D conversion failed." };
  }
}
