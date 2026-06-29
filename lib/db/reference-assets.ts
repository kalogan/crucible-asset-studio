import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import {
  ReferenceAsset,
  ReferenceAssetInsert,
  type ReferenceAssetInsert as ReferenceAssetInsertT,
} from "@/lib/schema";

export async function createReferenceAsset(
  input: ReferenceAssetInsertT,
): Promise<ReferenceAsset> {
  const supabase = createServiceClient();
  const payload = ReferenceAssetInsert.parse(input);
  // Re-sync: a same art_kit_id render replaces the previous one.
  if (payload.art_kit_id) {
    await supabase
      .from("reference_assets")
      .delete()
      .eq("project_id", payload.project_id)
      .eq("art_kit_id", payload.art_kit_id);
  }
  const { data, error } = await supabase
    .from("reference_assets")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`createReferenceAsset: ${error.message}`);
  return ReferenceAsset.parse(data);
}

export async function updateReferenceAssetNotes(
  id: string,
  notes: string,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("reference_assets")
    .update({ notes })
    .eq("id", id);
  if (error) throw new Error(`updateReferenceAssetNotes: ${error.message}`);
}

export async function listReferenceAssetsByProject(
  projectId: string,
): Promise<ReferenceAsset[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("reference_assets")
    .select()
    .eq("project_id", projectId)
    .order("asset_type", { ascending: true })
    .order("label", { ascending: true });
  if (error) throw new Error(`listReferenceAssetsByProject: ${error.message}`);
  return (data ?? []).map((r) => ReferenceAsset.parse(r));
}
