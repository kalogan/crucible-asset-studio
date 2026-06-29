"use server";

import { revalidatePath } from "next/cache";
import { getActiveProject } from "@/lib/active-project";
import { createAssetSystem, updateAssetSystem } from "@/lib/db/asset-systems";
import { Manifest as ManifestSchema } from "@/lib/asset-system/schema";
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

/**
 * Replace a saved system's manifest with a fully edited one. Reads `systemId` +
 * `manifestJson` (the complete manifest the editor serialized — parts/params kept
 * intact, lights/sounds replaced), validates the JSON against the Zod `Manifest`
 * schema, then persists it. Validation failures surface as a friendly error.
 */
export async function updateAssetSystemManifestAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const systemId = String(formData.get("systemId") ?? "").trim();
  if (!systemId) return { ok: false, error: "Missing system id." };

  let manifest: Manifest;
  try {
    const raw = String(formData.get("manifestJson") ?? "");
    const parsed: unknown = JSON.parse(raw);
    manifest = ManifestSchema.parse(parsed);
  } catch {
    return { ok: false, error: "Could not read the edited manifest." };
  }

  try {
    await updateAssetSystem(systemId, { manifest });
    revalidatePath("/systems");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Update failed.",
    };
  }
}
