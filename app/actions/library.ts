"use server";

import { revalidatePath } from "next/cache";
import { updateReferenceAssetNotes } from "@/lib/db/reference-assets";
import { updateAsset } from "@/lib/db/assets";
import type { ActionResult } from "./projects";

/**
 * Save the director's notes on a library asset. Routes to the right table by
 * `source` ("procgen" → reference_assets, "generated" → assets).
 */
export async function saveAssetNotesAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const source = String(formData.get("source") ?? "");
  const notes = String(formData.get("notes") ?? "").slice(0, 4000);
  if (!id) return { ok: false, error: "Missing asset id." };

  try {
    if (source === "generated") {
      await updateAsset(id, { notes });
    } else {
      await updateReferenceAssetNotes(id, notes);
    }
    revalidatePath("/library");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed." };
  }
}
