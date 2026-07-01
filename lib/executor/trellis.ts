/**
 * TRELLIS image-to-3D preset (KERNEL_LESSONS §4). The exact params that worked,
 * including slat_guidance_strength: 1.5 (lowered from 3 to stop TRELLIS recoloring
 * away from the source palette — directly serves "on-canon" output).
 */
export const TRELLIS_DEFAULTS = {
  texture_size: 1024,
  mesh_simplify: 0.95,
  generate_color: true,
  generate_model: true,
  generate_normal: false,
  randomize_seed: false,
  seed: 0,
  ss_sampling_steps: 12,
  slat_sampling_steps: 12,
  ss_guidance_strength: 7.5,
  slat_guidance_strength: 1.5,
} as const;

export interface TrellisOptions {
  /**
   * Mesh decimation target. Lower = MORE geometry retained. Defaults to the tuned
   * 0.95 preset; rig-ready T-pose characters pass 0.88 so joints (elbows, knees,
   * shoulders) keep enough polygons to auto-rig cleanly.
   */
  meshSimplify?: number;
}

export function trellisInput(
  imageUrl: string,
  opts: TrellisOptions = {},
): Record<string, unknown> {
  return {
    images: [String(imageUrl)], // string-coerce — guards against null leaking in
    ...TRELLIS_DEFAULTS,
    mesh_simplify: opts.meshSimplify ?? TRELLIS_DEFAULTS.mesh_simplify,
  };
}

/**
 * Normalize TRELLIS output into a GLB URL. Output may be { model_file }, an array,
 * a bare string, or { url }. Returns null only after exhausting all shapes.
 */
export function normalizeModelUrl(output: unknown): string | null {
  if (!output) return null;
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    return output.length > 0 ? normalizeModelUrl(output[0]) : null;
  }
  if (typeof output === "object") {
    const o = output as Record<string, unknown>;
    if (typeof o.model_file === "string") return o.model_file;
    if (typeof o.url === "string") return o.url;
  }
  return null;
}
