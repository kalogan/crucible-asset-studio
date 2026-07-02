import "server-only";
import { startPrediction, pollPrediction, normalizeModelUrl } from "@/lib/executor";

/**
 * UniRig auto-rig (Replicate) — the "kit"-worthy core of our character rigging.
 *
 * UniRig ("One Model to Rig Them All", SIGGRAPH'25) is an ML auto-rigger: given an
 * arbitrary mesh it predicts a topologically-valid skeleton AND per-vertex skin weights.
 * It replaces our old geometric nearest-bone weighting, which tore generated limbs into
 * stretched "taffy" sheets. UniRig's weights deform as coherent volumes (verified on a
 * generated humanoid: clean shoulders/hips/knees, plus fingers + toes).
 *
 * It does NOT author animation clips — the returned GLB is a skinned T/rest-pose mesh.
 * Clips (idle/cast/guard/strike/hit) are added afterward by scripts/rig/unirig_clips.py,
 * which classifies UniRig's generic `bone_N` names into humanoid roles and keyframes them.
 */
export const UNIRIG_MODEL = "aaronjmars/unirig-ai";

/** UniRig can take a couple of minutes; give it a generous budget. */
const UNIRIG_TIMEOUT_MS = 15 * 60_000;

export interface UniRigResult {
  /** Temporary Replicate URL of the rigged (skinned, un-animated) GLB. Persist promptly. */
  riggedUrl: string;
  predictionId: string;
}

/**
 * Run UniRig on a mesh URL and return the rigged GLB URL.
 *
 * IMPORTANT: `meshUrl`'s PATH must end in `.glb` (or .obj/.fbx/.vrm). UniRig sniffs the
 * file type from the download filename; a Replicate files-API URL (no real extension)
 * fails with "file_type ... not supported". A stored Supabase public `.glb` URL works.
 */
export async function rigWithUniRig(
  meshUrl: string,
  opts: { onStatus?: (s: string) => void; signal?: AbortSignal } = {},
): Promise<UniRigResult> {
  const pred = await startPrediction(UNIRIG_MODEL, { input_mesh: meshUrl });
  const output = await pollPrediction(pred.id, {
    timeoutMs: UNIRIG_TIMEOUT_MS,
    onStatus: opts.onStatus,
    signal: opts.signal,
  });
  const riggedUrl = normalizeModelUrl(output);
  if (!riggedUrl) {
    throw new Error("UniRig returned no model URL");
  }
  return { riggedUrl, predictionId: pred.id };
}
