import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import {
  AssetSystem,
  AssetSystemInsert,
  type AssetSystem as AssetSystemT,
  type AssetSystemInsert as AssetSystemInsertT,
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
