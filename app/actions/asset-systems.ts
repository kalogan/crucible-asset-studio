"use server";

import { revalidatePath } from "next/cache";
import { getActiveProject } from "@/lib/active-project";
import { createAssetSystem } from "@/lib/db/asset-systems";
import type { Manifest } from "@/lib/asset-system/schema";
import type { ActionResult } from "./projects";

/**
 * Group the selected library assets into a reusable system. Reads `name` + a
 * `partsJson` field (a JSON array of assetId strings) and builds a manifest with
 * each id as a part at origin (position [0,0,0], rotation [0,0,0], scale 1).
 * Lights / fx / sound live in the schema but have no editor UI yet (future step).
 */
export async function createAssetSystemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Enter a system name." };

  let assetIds: string[];
  try {
    const raw = String(formData.get("partsJson") ?? "[]");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("partsJson must be an array.");
    assetIds = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return { ok: false, error: "Could not read the selected assets." };
  }
  if (assetIds.length === 0) {
    return { ok: false, error: "Select at least one asset." };
  }

  const active = await getActiveProject();
  if (!active) return { ok: false, error: "No active project." };

  const manifest: Manifest = {
    parts: assetIds.map((assetId) => ({
      assetId,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: 1,
    })),
  };

  try {
    await createAssetSystem({ project_id: active.id, name, manifest });
    revalidatePath("/systems");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Create failed.",
    };
  }
}
