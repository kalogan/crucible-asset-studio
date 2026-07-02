"use server";

import { revalidatePath } from "next/cache";
import {
  getReferenceAsset,
  listAssetVersions,
  setCurrentVersion,
} from "@/lib/db/reference-assets";

export interface AssetVersion {
  id: string;
  version: number;
  isCurrent: boolean;
  url: string;
  createdAt: string;
}

/**
 * All versions of an asset's lineage (its project + art_kit_id), newest first — for the
 * modal's version flipper / A-B compare. Returns [] when the asset has no lineage or only
 * one version (nothing to flip through).
 */
export async function getAssetVersions(assetId: string): Promise<AssetVersion[]> {
  const asset = await getReferenceAsset(assetId);
  if (!asset || !asset.art_kit_id) return [];
  const rows = await listAssetVersions(asset.project_id, asset.art_kit_id);
  if (rows.length <= 1) return [];
  return rows.map((r) => ({
    id: r.id,
    version: r.version,
    isCurrent: r.is_current,
    url: r.image_path,
    createdAt: r.created_at,
  }));
}

/** Roll an older version back to current (demotes the rest of the lineage). */
export async function promoteAssetVersion(assetId: string): Promise<{ ok: boolean }> {
  await setCurrentVersion(assetId);
  revalidatePath("/assets");
  revalidatePath("/library");
  return { ok: true };
}
