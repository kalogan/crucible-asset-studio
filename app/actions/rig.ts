"use server";

// ⚠️ LOCAL-STUDIO ONLY. This action shells out to a portable Blender under `tools/` to
// auto-rig a model GLB, then re-imports the rigged result as a new library asset. It uses
// node:child_process + the local filesystem and CANNOT run on Vercel (no Blender, read-only
// FS). On deploy it degrades gracefully: `resolveBlender()` returns null → a clear
// "local-only / run setup-blender" error, and node:child_process is imported dynamically so
// the serverless bundle never eagerly pulls it in. Nothing here runs unless the user clicks
// "Rig this" in the asset modal on their own machine.

import { revalidatePath } from "next/cache";
import { existsSync, readdirSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getReferenceAsset, createReferenceAsset } from "@/lib/db/reference-assets";
import { getProject } from "@/lib/db/projects";
import { persistBase64ToStorage, contentHash } from "@/lib/executor";
import { deriveRiggedMeta } from "@/lib/rig/derive";

export type RigResult =
  | { ok: true; id: string; url: string; label: string }
  | { ok: false; error: string };

export interface RigInput {
  /** The source reference asset (a `format: "model"` GLB) to rig. */
  assetId: string;
  /** Rest pose to author the rig in. adown = arms-down (default), tpose = T-pose. */
  pose?: "adown" | "tpose";
}

const REPO = process.cwd();

/** Find the portable Blender exe under tools/ — mirrors scripts/auto-rig.mjs. Null ⇒ not
 *  installed / not local (e.g. serverless), which we surface as a clear error. */
function resolveBlender(): string | null {
  const toolsDir = path.join(REPO, "tools");
  if (!existsSync(toolsDir)) return null;
  for (const name of readdirSync(toolsDir)) {
    if (!name.startsWith("blender-")) continue;
    for (const exe of ["blender.exe", "blender"]) {
      const p = path.join(toolsDir, name, exe);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

/**
 * Auto-rig a model asset (LOCAL only): download its GLB → run the auto-rig CLI via a local
 * Blender → re-import the rigged, animated GLB as a NEW `character` model asset in the SAME
 * project (art-kit id `<sourceKey>-rigged`, so re-rigging re-syncs).
 */
export async function rigAssetAction(input: RigInput): Promise<RigResult> {
  const pose = input.pose === "tpose" ? "tpose" : "adown";

  // Guard: Blender must be present locally. On deploy tools/ is absent → clear message.
  const blender = resolveBlender();
  if (!blender) {
    return {
      ok: false,
      error:
        "Auto-rig is a local-studio feature: no Blender found in tools/. Run `node scripts/setup-blender.mjs` on your machine first (this can't run on the deployed app).",
    };
  }

  const asset = await getReferenceAsset(input.assetId);
  if (!asset) return { ok: false, error: "Asset not found." };
  if (asset.format !== "model") return { ok: false, error: "Only model (GLB) assets can be rigged." };
  if (!asset.image_path) return { ok: false, error: "Asset has no source URL." };

  const project = await getProject(asset.project_id);
  if (!project) return { ok: false, error: "Project not found for asset." };

  const meta = deriveRiggedMeta({ label: asset.label, artKitId: asset.art_kit_id });

  // Scratch dir for the rigged output; always cleaned up.
  const work = await mkdtemp(path.join(tmpdir(), "crucible-rig-"));
  const outPath = path.join(work, "out.glb");
  try {
    // Run the auto-rig CLI (Blender). The default engine is UniRig (ML skeleton+skin on
    // Replicate, then world-space clips), so this now takes MINUTES (UniRig ~2-4m + clips
    // + up/download), not seconds. We pass the asset's stored .glb URL straight through:
    // UniRig fetches it directly (its path already ends in .glb), so no re-upload. `--pose`
    // only affects the legacy geometric engine; UniRig defines its own rest pose. Dynamic
    // import keeps node:child_process out of any serverless bundle.
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const run = promisify(execFile);
    try {
      await run(
        process.execPath,
        [path.join(REPO, "scripts", "auto-rig.mjs"), asset.image_path, "--out", outPath, "--pose", pose],
        { cwd: REPO, timeout: 12 * 60_000, maxBuffer: 32 * 1024 * 1024 },
      );
    } catch (err) {
      // execFile rejects with { stderr } on non-zero exit — surface the rig's own message.
      const e = err as { stderr?: string; message?: string };
      const detail = (e.stderr?.trim() || e.message || "unknown error").split("\n").slice(-4).join("\n");
      return { ok: false, error: `Auto-rig failed:\n${detail}` };
    }
    if (!existsSync(outPath)) return { ok: false, error: "Auto-rig produced no output GLB." };

    // 3) Re-import: persist the rigged GLB to durable Storage + create a NEW asset VERSION.
    //    createReferenceAsset now version-not-deletes on the art_kit_id (keeps history), and
    //    the content-hashed path means each re-rig writes a new file so the prior GLB survives.
    const bytes = await readFile(outPath);
    const safe = meta.artKitId.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${project.slug}/reference/${meta.assetType}/${safe}.${contentHash(bytes)}.glb`;
    const url = await persistBase64ToStorage({
      base64: bytes.toString("base64"),
      mimeType: "model/gltf-binary",
      path: storagePath,
    });
    const created = await createReferenceAsset({
      project_id: project.id,
      asset_type: meta.assetType,
      label: meta.label,
      source: "procgen",
      format: meta.kind,
      image_path: url,
      art_kit_id: meta.artKitId,
      tags: asset.tags,
    });

    revalidatePath("/library");
    revalidatePath("/assets");
    return { ok: true, id: created.id, url, label: meta.label };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Rig failed." };
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}
