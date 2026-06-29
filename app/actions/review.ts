"use server";

import { revalidatePath } from "next/cache";
import { updateAsset } from "@/lib/db/assets";
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
