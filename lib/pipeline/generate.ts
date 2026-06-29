import "server-only";
import { createAssetSpec, getAssetSpec } from "@/lib/db/specs";
import { createJob, updateJob } from "@/lib/db/jobs";
import { createAsset, getAsset, updateAsset } from "@/lib/db/assets";
import { getProject } from "@/lib/db/projects";
import { getCanonByProject } from "@/lib/db/canons";
import {
  generateImage,
  removeBackground,
  generateModelFromImage,
  persistToStorage,
  persistBase64ToStorage,
  extForContentType,
  generateImageNanoBanana,
  enrichPrompt,
  FLUX_TEXT2IMG,
  TRELLIS_DEFAULTS,
} from "@/lib/executor";
import type { Asset, Canon } from "@/lib/schema";
import { buildFinalPrompt } from "@/lib/canon/prompt";
import { framingFor } from "@/lib/canon/framing";
import { buildStoragePath, catalogKeyFor } from "./paths";

export type ImageProvider = "flux" | "nanobanana";

export interface PipelineInput {
  projectId: string;
  projectSlug: string;
  title: string;
  prompt: string;
  assetType?: string;
  provider?: ImageProvider;
}

function referenceUrls(canon: Canon | null): string[] {
  if (!canon || !Array.isArray(canon.reference_imgs)) return [];
  return canon.reference_imgs.filter((x): x is string => typeof x === "string");
}

/**
 * Canon-aware subject expansion. When a canon governs style, enrichment must
 * describe ONLY the object (form/parts/materials) — never rendering/realism/
 * lighting — so it can't fight the canon (the bug that made a "faceted low-poly"
 * palm come out photoreal). Without a canon, fall back to the generic enrich.
 */
const CANON_SUBJECT_SYSTEM =
  "Expand the user's asset request into a concrete description of the OBJECT only — " +
  "its form, parts, proportions, and materials. Do NOT mention art style, rendering " +
  "technique, realism, level of detail, lighting, camera, framing, or background — " +
  "those are defined separately by the art canon. Reply with ONLY the description, 20-50 words.";

async function expandSubject(canon: Canon | null, prompt: string): Promise<string> {
  return canon
    ? enrichPrompt(prompt, { system: CANON_SUBJECT_SYSTEM })
    : enrichPrompt(prompt);
}

function baseRecipe(input: PipelineInput, canon: Canon | null, finalPrompt: string) {
  return {
    title: input.title,
    prompt: finalPrompt,
    image_model: FLUX_TEXT2IMG,
    canon_id: canon?.id ?? null,
    canon_name: canon?.name ?? null,
    lora_ref: canon?.lora_ref ?? null,
    lora_trigger: canon?.lora_trigger ?? null,
  } satisfies Record<string, unknown>;
}

/** FLUX text->image, persisted. Sets job phase 'image'. */
async function generate2D(
  jobId: string,
  input: PipelineInput,
  canon: Canon | null,
  catalogKey: string,
) {
  await updateJob(jobId, { phase: "image" });
  // Canon supplies style; the asset-type framing supplies format (+ format nevers).
  const framing = framingFor(input.assetType ?? "prop");
  const subject = await expandSubject(canon, input.prompt);
  const framedSubject = framing.formatCues ? `${subject}, ${framing.formatCues}` : subject;
  const finalPrompt = buildFinalPrompt(canon, framedSubject, framing.nevers);

  // Nano Banana (Gemini 2.5 Flash Image): text→image + canon reference images as a
  // style anchor. Returns inline base64; persist it. Fail-soft -> null if no key.
  if (input.provider === "nanobanana") {
    const img = await generateImageNanoBanana(finalPrompt, {
      referenceImageUrls: referenceUrls(canon),
    });
    if (!img) {
      throw new Error("Nano Banana returned no image — is GEMINI_API_KEY set?");
    }
    const imageUrl = await persistBase64ToStorage({
      base64: img.base64,
      mimeType: img.mimeType,
      path: buildStoragePath(input.projectSlug, catalogKey, extForContentType(img.mimeType)),
    });
    return { imageUrl, finalPrompt, predictionId: "nanobanana" };
  }

  const image = await generateImage(finalPrompt, { width: 1024, height: 1024 });
  const imageUrl = await persistToStorage({
    sourceUrl: image.url,
    path: buildStoragePath(input.projectSlug, catalogKey, "png"),
    contentType: "image/png",
  });
  return { imageUrl, finalPrompt, predictionId: image.predictionId };
}

/** Background cutout (fail-soft) -> TRELLIS -> persisted GLB. Phases cutout/model/saving. */
async function generate3D(
  jobId: string,
  projectSlug: string,
  catalogKey: string,
  sourceImageUrl: string,
) {
  await updateJob(jobId, { phase: "cutout" });
  let cutoutUrl = sourceImageUrl;
  try {
    cutoutUrl = await removeBackground(sourceImageUrl);
  } catch {
    // keep the original image
  }
  await updateJob(jobId, { phase: "model" });
  const model = await generateModelFromImage(cutoutUrl);
  await updateJob(jobId, { phase: "saving" });
  const glbUrl = await persistToStorage({
    sourceUrl: model.url,
    path: buildStoragePath(projectSlug, catalogKey, "glb"),
    contentType: "model/gltf-binary",
  });
  return { glbUrl, predictionId: model.predictionId };
}

/** Image-only: cheap FLUX -> review queue as a 2D image (no TRELLIS spend yet). */
export async function runImagePipeline(input: PipelineInput): Promise<Asset> {
  const catalogKey = catalogKeyFor(input.title);
  const canon = await getCanonByProject(input.projectId);
  const spec = await createAssetSpec({
    project_id: input.projectId,
    canon_id: canon?.id ?? null,
    catalog_key: catalogKey,
    asset_type: "model_3d",
    title: input.title,
    prompt: input.prompt,
  });
  const job = await createJob({ spec_id: spec.id, status: "generating", executor: "replicate" });
  try {
    const { imageUrl, finalPrompt, predictionId } = await generate2D(job.id, input, canon, catalogKey);
    const recipe = { ...baseRecipe(input, canon, finalPrompt), image_url: imageUrl, image_prediction: predictionId };
    await updateJob(job.id, { status: "succeeded", phase: "saving", provider_ref: predictionId, recipe_snapshot: recipe, cost: 0.01 });
    return createAsset({
      project_id: input.projectId,
      spec_id: spec.id,
      job_id: job.id,
      stage: "in_review",
      kind: "image",
      raw_path: imageUrl,
      recipe_snapshot: recipe,
    });
  } catch (err) {
    await updateJob(job.id, { status: "failed", error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/** Full 2D->3D: FLUX -> cutout -> TRELLIS -> review queue as a 3D model. */
export async function runGenerationPipeline(input: PipelineInput): Promise<Asset> {
  const catalogKey = catalogKeyFor(input.title);
  const canon = await getCanonByProject(input.projectId);
  const spec = await createAssetSpec({
    project_id: input.projectId,
    canon_id: canon?.id ?? null,
    catalog_key: catalogKey,
    asset_type: "model_3d",
    title: input.title,
    prompt: input.prompt,
  });
  const job = await createJob({ spec_id: spec.id, status: "generating", executor: "replicate" });
  try {
    const img = await generate2D(job.id, input, canon, catalogKey);
    const { glbUrl, predictionId } = await generate3D(job.id, input.projectSlug, catalogKey, img.imageUrl);
    const recipe = {
      ...baseRecipe(input, canon, img.finalPrompt),
      model_3d: "firtoz/trellis",
      image_url: img.imageUrl,
      image_prediction: img.predictionId,
      model_prediction: predictionId,
      trellis: TRELLIS_DEFAULTS,
    };
    await updateJob(job.id, { status: "succeeded", provider_ref: predictionId, recipe_snapshot: recipe, cost: 0.09 });
    return createAsset({
      project_id: input.projectId,
      spec_id: spec.id,
      job_id: job.id,
      stage: "in_review",
      kind: "model",
      raw_path: glbUrl,
      recipe_snapshot: recipe,
    });
  } catch (err) {
    await updateJob(job.id, { status: "failed", error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/** Promote a reviewed 2D image asset to 3D — the expensive TRELLIS step, on demand. */
export async function convertAssetTo3D(assetId: string): Promise<Asset> {
  const asset = await getAsset(assetId);
  if (!asset) throw new Error("Asset not found.");
  if (asset.kind !== "image") throw new Error("Asset is already a 3D model.");
  const sourceImage =
    asset.raw_path ?? (asset.recipe_snapshot["image_url"] as string | undefined) ?? null;
  if (!sourceImage) throw new Error("No source image to convert.");

  const spec = asset.spec_id ? await getAssetSpec(asset.spec_id) : null;
  const project = await getProject(asset.project_id);
  if (!project) throw new Error("Project not found.");
  const catalogKey = spec?.catalog_key ?? catalogKeyFor(String(asset.recipe_snapshot["title"] ?? assetId));

  const job = await createJob({
    spec_id: asset.spec_id ?? spec?.id ?? "",
    status: "generating",
    executor: "replicate",
  });
  try {
    const { glbUrl, predictionId } = await generate3D(job.id, project.slug, catalogKey, sourceImage);
    const recipe = {
      ...asset.recipe_snapshot,
      model_3d: "firtoz/trellis",
      model_prediction: predictionId,
      trellis: TRELLIS_DEFAULTS,
    };
    await updateJob(job.id, { status: "succeeded", provider_ref: predictionId, recipe_snapshot: recipe, cost: 0.08 });
    return updateAsset(asset.id, {
      kind: "model",
      stage: "in_review",
      raw_path: glbUrl,
      recipe_snapshot: recipe,
    });
  } catch (err) {
    await updateJob(job.id, { status: "failed", error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}
