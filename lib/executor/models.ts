/**
 * Replicate model registry + request routing.
 *
 * KERNEL_LESSONS §1: Replicate has TWO prediction APIs that are not interchangeable.
 * Versioned models (e.g. firtoz/trellis) POST to /predictions with { version, input };
 * model-endpoint models POST to /models/{owner}/{name}/predictions with { input }.
 * Fast models additionally get `Prefer: wait` for a synchronous response.
 */

export const REPLICATE_API = "https://api.replicate.com/v1";

export type ModelKind = "endpoint" | "versioned";

export interface ModelDef {
  kind: ModelKind;
  /** pinned version hash — required for `versioned` models */
  hash?: string;
  /** supports `Prefer: wait` (responds synchronously within ~60s) */
  fast?: boolean;
}

export const MODEL_REGISTRY: Record<string, ModelDef> = {
  "black-forest-labs/flux-schnell": { kind: "endpoint", fast: true },
  "black-forest-labs/flux-redux-schnell": { kind: "endpoint", fast: true },
  "lucataco/remove-bg": { kind: "endpoint", fast: true },
  "nightmareai/real-esrgan": { kind: "endpoint" },
  // ⚠️ Re-verify this pinned hash against Replicate before the first 3D run
  // (KERNEL_LESSONS §1 — the reference carried a contradictory note).
  "firtoz/trellis": {
    kind: "versioned",
    hash: "4876f2a8da1c544772dffa32e8889da4a1bab3a1f5c1937bfcfccb99ae347251",
  },
  // UniRig (SIGGRAPH'25) — ML auto-rigger: predicts skeleton + skin weights from an
  // arbitrary mesh. Replaces our geometric nearest-bone skinning (which tore limbs into
  // "taffy" on generated meshes). Input: { input_mesh: <.glb url> }; output: a rigged .glb
  // (no animation clips — those are authored afterward by scripts/rig/unirig_clips.py).
  // NOTE: the input URL's PATH must end in .glb — the Replicate files-API URL fails
  // file-type sniffing; a stored Supabase .glb URL works.
  "aaronjmars/unirig-ai": {
    kind: "versioned",
    hash: "9ee496eafcc6ab9789a110a6357e43e5ee8b93cee9ab653bdc6f06a29341ee86",
  },
};

export interface ResolvedRequest {
  endpoint: string;
  body: Record<string, unknown>;
  useWait: boolean;
}

/**
 * Resolve (model | explicit version, input) into the correct endpoint + body shape.
 * An explicit `version` always routes to the versioned endpoint.
 */
export function resolveModelRequest(
  model: string | null,
  input: Record<string, unknown>,
  version?: string | null,
): ResolvedRequest {
  if (version) {
    return {
      endpoint: `${REPLICATE_API}/predictions`,
      body: { version, input },
      useWait: false,
    };
  }
  if (!model) {
    throw new Error("resolveModelRequest: a model or an explicit version is required");
  }
  const def = MODEL_REGISTRY[model];
  if (!def) throw new Error(`Unknown model: ${model}`);

  if (def.kind === "versioned") {
    if (!def.hash) throw new Error(`Versioned model ${model} is missing a pinned hash`);
    return {
      endpoint: `${REPLICATE_API}/predictions`,
      body: { version: def.hash, input },
      useWait: false,
    };
  }

  const [owner, name] = model.split("/");
  if (!owner || !name) throw new Error(`Malformed model id: ${model}`);
  return {
    endpoint: `${REPLICATE_API}/models/${owner}/${name}/predictions`,
    body: { input },
    useWait: def.fast === true,
  };
}
