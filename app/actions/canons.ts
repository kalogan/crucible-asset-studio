"use server";

import { revalidatePath } from "next/cache";
import {
  createCanon,
  updateCanon,
  getCanonByProject,
  type CanonUpdate,
} from "@/lib/db/canons";
import { getActiveProject } from "@/lib/active-project";
import { seedForSlug } from "@/lib/canon/seeds";
import type { ActionResult } from "./projects";

/** Parse the canon form (prefix/suffix/negative + newline-delimited do/never). */
function parseCanonForm(formData: FormData): CanonUpdate {
  const lines = (name: string) =>
    String(formData.get(name) ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  return {
    name: String(formData.get("name") ?? "").trim() || undefined,
    prompt_prefix: String(formData.get("prompt_prefix") ?? "").trim(),
    prompt_suffix: String(formData.get("prompt_suffix") ?? "").trim(),
    negative_prompt: String(formData.get("negative_prompt") ?? "").trim(),
    reference_imgs: lines("reference_imgs").filter((u) => /^https?:\/\//i.test(u)),
    style_guide: {
      do: lines("do_rules"),
      never: lines("never_rules"),
      palette: parsePalette(String(formData.get("palette") ?? "")),
    },
  };
}

/** "#ffb24d, #ff8c42" -> { hexes: [...] } */
function parsePalette(raw: string): Record<string, unknown> {
  const hexes = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^#?[0-9a-fA-F]{6}$/.test(s))
    .map((s) => (s.startsWith("#") ? s : `#${s}`));
  return hexes.length ? { hexes } : {};
}

export async function saveCanonAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const active = await getActiveProject();
    if (!active) return { ok: false, error: "No active project." };
    const patch = parseCanonForm(formData);
    const existing = await getCanonByProject(active.id);
    if (existing) {
      await updateCanon(existing.id, patch);
    } else {
      await createCanon({
        project_id: active.id,
        name: patch.name ?? `${active.name} canon`,
        prompt_prefix: patch.prompt_prefix,
        prompt_suffix: patch.prompt_suffix,
        negative_prompt: patch.negative_prompt,
        reference_imgs: patch.reference_imgs,
        style_guide: patch.style_guide,
      });
    }
    revalidatePath("/canon");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save canon." };
  }
}

/** One-click: seed a hand-authored canon from a project's art bible (no Anthropic
 *  needed). Matches the active project's slug to a seed template (wayfinders,
 *  living-dungeon, …). */
export async function seedCanonAction(
  _prev: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  try {
    const active = await getActiveProject();
    if (!active) return { ok: false, error: "No active project." };
    if (await getCanonByProject(active.id)) {
      return { ok: false, error: "This project already has a canon." };
    }
    const seed = seedForSlug(active.slug);
    if (!seed) {
      return {
        ok: false,
        error: `No built-in canon template for "${active.slug}". Use Intake to auto-draft, or fill the form.`,
      };
    }
    await createCanon(seed(active.id));
    revalidatePath("/canon");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to seed canon." };
  }
}
