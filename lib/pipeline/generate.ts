import "server-only";
import { createAssetSpec } from "@/lib/db/specs";
import { createJob, updateJob } from "@/lib/db/jobs";
import { createAsset } from "@/lib/db/assets";
import {
  generateImage,
  removeBackground,
  generateModelFromImage,
  persistToStorage,
  enrichPrompt,
  FLUX_TEXT2IMG,
  TRELLIS_DEFAULTS,
} from "@/lib/executor";
import type { Asset } from "@/lib/schema";
import { buildStoragePath, catalogKeyFor } from "./paths";

export interface PipelineInput {
  projectId: string;
  projectSlug: string;
  title: string;
  prompt: string;
}

/**
 * The Phase-1 vertical slice: hand-entered spec -> (optional) Claude enrich ->
 * FLUX text-to-image -> persist -> background cutout -> TRELLIS image-to-3D ->
 * persist GLB -> asset in_review. Canon-free in Phase 1 (no LoRA); Phase 2 swaps
 * the generic enrich for canon scaffolding. Reproducibility frozen in recipe_snapshot.
 *
 * NOTE: synchronous + long (~2 min). Fine for local/single runs; Phase 3 moves bulk
 * generation to the resumable batch worker (Vercel function timeouts make sync
 * generation prod-unsafe at volume).
 */
export async function runGenerationPipeline(input: PipelineInput): Promise<Asset> {
  const catalogKey = catalogKeyFor(input.title);

  const spec = await createAssetSpec({
    project_id: input.projectId,
    catalog_key: catalogKey,
    asset_type: "model_3d",
    title: input.title,
    prompt: input.prompt,
  });
  const job = await createJob({
    spec_id: spec.id,
    status: "generating",
    executor: "replicate",
  });

  try {
    const enriched = await enrichPrompt(input.prompt);
    const finalPrompt = `${enriched}, isolated object, neutral background`;

    // 1. FLUX text -> image, persist the raw 2D output.
    const image = await generateImage(finalPrompt, { width: 1024, height: 1024 });
    const imagePath = buildStoragePath(input.projectSlug, catalogKey, "png");
    const imageUrl = await persistToStorage({
      sourceUrl: image.url,
      path: imagePath,
      contentType: "image/png",
    });

    // 2. Background cutout (fail-soft — a clean isolated subject -> better mesh).
    let cutoutUrl = image.url;
    try {
      cutoutUrl = await removeBackground(image.url);
    } catch {
      // keep the original image
    }

    // 3. TRELLIS image -> 3D, persist the GLB.
    const model = await generateModelFromImage(cutoutUrl);
    const glbPath = buildStoragePath(input.projectSlug, catalogKey, "glb");
    const glbUrl = await persistToStorage({
      sourceUrl: model.url,
      path: glbPath,
      contentType: "model/gltf-binary",
    });

    const recipe: Record<string, unknown> = {
      title: input.title,
      prompt: finalPrompt,
      image_model: FLUX_TEXT2IMG,
      model_3d: "firtoz/trellis",
      image_url: imageUrl,
      image_prediction: image.predictionId,
      model_prediction: model.predictionId,
      trellis: TRELLIS_DEFAULTS,
      lora_ref: null,
      canon_id: null,
    };

    await updateJob(job.id, {
      status: "succeeded",
      provider_ref: model.predictionId,
      recipe_snapshot: recipe,
      cost: 0.09,
    });

    return createAsset({
      project_id: input.projectId,
      spec_id: spec.id,
      job_id: job.id,
      stage: "in_review",
      raw_path: glbUrl,
      recipe_snapshot: recipe,
    });
  } catch (err) {
    await updateJob(job.id, {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
