/**
 * Pure derivation of the re-import metadata for an auto-rigged model. Extracted so the
 * naming rules (art-kit id / label / type / kind) are unit-testable without spinning up
 * Blender or the DB. See `app/actions/rig.ts` for the caller.
 */

/** The reference-asset shape a rigged GLB is re-imported as. */
export interface RiggedMeta {
  /** `<sourceKey>-rigged` so re-rigging the same source re-syncs (createReferenceAsset
   *  deletes-then-inserts on a matching art_kit_id). */
  artKitId: string;
  label: string;
  /** A rigged, animated humanoid is a character. */
  assetType: "character";
  /** Still a live 3D model (GLB with clips). */
  kind: "model";
}

/**
 * Given a source model's label + art-kit id, derive the metadata for its rigged copy.
 * Falls back to a slugified label when the source has no art-kit id (e.g. a `generated`
 * asset), so the derived id is always stable + storage-safe.
 */
export function deriveRiggedMeta({
  label,
  artKitId,
}: {
  label: string;
  artKitId: string | null;
}): RiggedMeta {
  const base = artKitId?.trim()
    ? artKitId.trim()
    : label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
  // Idempotent: rigging an already-`…-rigged` key must not stack suffixes.
  const key = base.endsWith("-rigged") ? base : `${base}-rigged`;
  const cleanLabel = label.trim() || "Asset";
  return {
    artKitId: key,
    label: cleanLabel.endsWith("(rigged)") ? cleanLabel : `${cleanLabel} (rigged)`,
    assetType: "character",
    kind: "model",
  };
}
