import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import {
  AssetSystem,
  AssetSystemInsert,
  Manifest,
  type AssetSystem as AssetSystemT,
  type AssetSystemInsert as AssetSystemInsertT,
  type Manifest as ManifestT,
} from "@/lib/asset-system/schema";

export async function createAssetSystem(
  input: AssetSystemInsertT,
): Promise<AssetSystemT> {
  const supabase = createServiceClient();
  const payload = AssetSystemInsert.parse(input);
  const { data, error } = await supabase
    .from("asset_systems")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`createAssetSystem: ${error.message}`);
  return AssetSystem.parse(data);
}

export async function listAssetSystemsByProject(
  projectId: string,
): Promise<AssetSystemT[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("asset_systems")
    .select()
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listAssetSystemsByProject: ${error.message}`);
  return (data ?? []).map((r) => AssetSystem.parse(r));
}

export interface AssetSystemPatch {
  name?: string;
  description?: string | null;
  manifest?: ManifestT;
}

/**
 * Partial update of a saved system. The optional `manifest` is re-parsed through
 * the Zod schema so an edited bundle (e.g. lights/sounds) is validated before it
 * hits the row, and the returned row is parsed back the same way the others are.
 */
export async function updateAssetSystem(
  id: string,
  patch: AssetSystemPatch,
): Promise<AssetSystemT> {
  const supabase = createServiceClient();
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.manifest !== undefined) update.manifest = Manifest.parse(patch.manifest);

  const { data, error } = await supabase
    .from("asset_systems")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateAssetSystem: ${error.message}`);
  return AssetSystem.parse(data);
}

export async function getAssetSystem(id: string): Promise<AssetSystemT | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("asset_systems")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getAssetSystem: ${error.message}`);
  if (!data) return null;
  return AssetSystem.parse(data);
}
