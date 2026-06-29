import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import {
  Asset,
  AssetInsert,
  type AssetInsert as AssetInsertT,
  type AssetStage,
} from "@/lib/schema";

export async function createAsset(input: AssetInsertT): Promise<Asset> {
  const supabase = createServiceClient();
  const payload = AssetInsert.parse(input);
  const { data, error } = await supabase
    .from("assets")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`createAsset: ${error.message}`);
  return Asset.parse(data);
}

export interface AssetUpdate {
  stage?: AssetStage;
  kind?: "image" | "model";
  raw_path?: string | null;
  finished_path?: string | null;
  cdn_url?: string | null;
  recipe_snapshot?: Record<string, unknown>;
  notes?: string;
}

export async function updateAsset(id: string, patch: AssetUpdate): Promise<Asset> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("assets")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateAsset: ${error.message}`);
  return Asset.parse(data);
}

export async function getAsset(id: string): Promise<Asset | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("assets")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getAsset: ${error.message}`);
  return data ? Asset.parse(data) : null;
}

export async function listAssetsByProject(
  projectId: string,
  stage?: AssetStage,
): Promise<Asset[]> {
  const supabase = createServiceClient();
  let query = supabase.from("assets").select().eq("project_id", projectId);
  if (stage) query = query.eq("stage", stage);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(`listAssetsByProject: ${error.message}`);
  return (data ?? []).map((row) => Asset.parse(row));
}
