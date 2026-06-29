"use server";

import { revalidatePath } from "next/cache";
import { getActiveProject } from "@/lib/active-project";
import {
  uploadTrainingImage,
  removeTrainingImage,
} from "@/lib/lora/storage";
import type { ActionResult } from "./projects";

export async function uploadTrainingImagesAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const active = await getActiveProject();
  if (!active) return { ok: false, error: "No active project." };

  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: "Choose at least one image." };

  try {
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await uploadTrainingImage(active.slug, file.name, bytes, file.type || "image/png");
    }
    revalidatePath("/canon");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Upload failed." };
  }
}

export async function removeTrainingImageAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const active = await getActiveProject();
  if (!active) return { ok: false, error: "No active project." };
  const name = String(formData.get("name") ?? "");
  if (!name) return { ok: false, error: "Missing image name." };
  try {
    await removeTrainingImage(active.slug, name);
    revalidatePath("/canon");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Remove failed." };
  }
}
