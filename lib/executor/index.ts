import "server-only";
import {
  startPrediction,
  pollPrediction,
  cancelPrediction,
  firstOutput,
} from "./replicate";
import { trellisInput, normalizeModelUrl, type TrellisOptions } from "./trellis";

/**
 * Poll to completion, but CANCEL the prediction if we give up (timeout/abort/error)
 * so it stops billing on Replicate's side (cost guardrail). Cancel is fire-and-forget.
 */
async function pollOrCancel(
  predictionId: string,
  opts: { timeoutMs: number; signal?: AbortSignal },
): Promise<unknown> {
  try {
    return await pollPrediction(predictionId, opts);
  } catch (err) {
    await cancelPrediction(predictionId);
    throw err;
  }
}

/**
 * High-level generation helpers — the surface S5 (and the future batch worker)
 * call. Each loads provider config server-side and returns a permanent-ready URL
 * from the provider (still temporary — caller persists via lib/executor/persist).
 */

export const FLUX_TEXT2IMG = "black-forest-labs/flux-schnell";

export interface GenImageOptions {
  width?: number;
  height?: number;
  model?: string;
  signal?: AbortSignal;
}

export interface GenResult {
  predictionId: string;
  url: string;
}

export async function generateImage(
  prompt: string,
  opts: GenImageOptions = {},
): Promise<GenResult> {
  const model = opts.model ?? FLUX_TEXT2IMG;
  const pred = await startPrediction(model, {
    prompt,
    width: opts.width ?? 1024,
    height: opts.height ?? 1024,
    num_outputs: 1,
    output_format: "png",
    output_quality: 100,
  });
  // Fast models with Prefer:wait may already be terminal.
  if (pred.status === "succeeded" && pred.output != null) {
    return { predictionId: pred.id, url: String(firstOutput(pred.output)) };
  }
  const output = await pollOrCancel(pred.id, { timeoutMs: 120_000, signal: opts.signal });
  return { predictionId: pred.id, url: String(firstOutput(output)) };
}

export async function removeBackground(
  imageUrl: string,
  opts: { signal?: AbortSignal } = {},
): Promise<string> {
  const pred = await startPrediction("lucataco/remove-bg", { image: imageUrl });
  if (pred.status === "succeeded" && pred.output != null) {
    return String(firstOutput(pred.output));
  }
  const output = await pollOrCancel(pred.id, { timeoutMs: 120_000, signal: opts.signal });
  return String(firstOutput(output));
}

/** TRELLIS image-to-3D → GLB URL. Allows minutes (KERNEL_LESSONS §4/§5). */
export async function generateModelFromImage(
  imageUrl: string,
  opts: { signal?: AbortSignal } & TrellisOptions = {},
): Promise<GenResult> {
  const pred = await startPrediction(
    "firtoz/trellis",
    trellisInput(imageUrl, { meshSimplify: opts.meshSimplify }),
  );
  const output = await pollOrCancel(pred.id, { timeoutMs: 360_000, signal: opts.signal });
  const url = normalizeModelUrl(output);
  if (!url) throw new Error("No GLB URL returned from TRELLIS");
  return { predictionId: pred.id, url };
}

export { startPrediction, pollPrediction, cancelPrediction, firstOutput } from "./replicate";
export { persistToStorage, persistBase64ToStorage, extForContentType, contentHash, STORAGE_BUCKET } from "./persist";
export { generateImageNanoBanana } from "./nanobanana";
export { enrichPrompt } from "./enrich";
export { normalizeModelUrl, trellisInput, TRELLIS_DEFAULTS } from "./trellis";
export type { TrellisOptions } from "./trellis";
export { resolveModelRequest, MODEL_REGISTRY } from "./models";
