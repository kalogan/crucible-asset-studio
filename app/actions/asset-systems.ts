"use server";

import { revalidatePath } from "next/cache";
import { getActiveProject } from "@/lib/active-project";
import { createAssetSystem, updateAssetSystem } from "@/lib/db/asset-systems";
import {
  AudioRecipe as AudioRecipeSchema,
  Manifest as ManifestSchema,
} from "@/lib/asset-system/schema";
import type { Manifest } from "@/lib/asset-system/schema";
import { bakeAudioAsset } from "@/lib/pipeline/audio";
import type { ActionResult } from "./projects";

/** Success shape for a sound bake: the client attaches `url` to a ManifestSound. */
export interface BakeSoundResult {
  ok: boolean;
  error?: string;
  url?: string;
}

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

/**
 * Bake an authored synth recipe to a stored WAV audio asset and return its public URL so
 * the sounds editor can attach it to a ManifestSound. Reads `label` (the audio title) +
 * `recipeJson` (an AudioRecipe the editor serialized), validates the recipe against the
 * Zod schema, then delegates to the pipeline's pure `bakeAudioAsset` (no cost gate — baking
 * is local synthesis). The manifest itself is persisted separately via the update action.
 */
export async function bakeSystemSoundAction(
  _prev: BakeSoundResult | null,
  formData: FormData,
): Promise<BakeSoundResult> {
  const title = String(formData.get("label") ?? "").trim();
  if (!title) return { ok: false, error: "Enter a sound label before baking." };

  let recipe;
  try {
    const raw = String(formData.get("recipeJson") ?? "");
    const parsed: unknown = JSON.parse(raw);
    recipe = AudioRecipeSchema.parse(parsed);
  } catch {
    return { ok: false, error: "Could not read the authored recipe." };
  }
  if (recipe.events.length === 0) {
    return { ok: false, error: "Add at least one event before baking." };
  }

  const active = await getActiveProject();
  if (!active) return { ok: false, error: "No active project." };

  try {
    const asset = await bakeAudioAsset({
      projectId: active.id,
      projectSlug: active.slug,
      title,
      recipe,
    });
    if (!asset.raw_path) {
      return { ok: false, error: "Bake produced no audio URL." };
    }
    revalidatePath("/systems");
    return { ok: true, url: asset.raw_path };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Bake failed.",
    };
  }
}
