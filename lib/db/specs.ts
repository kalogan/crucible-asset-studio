import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import {
  AssetSpec,
  AssetSpecInsert,
  type AssetSpecInsert as AssetSpecInsertT,
} from "@/lib/schema";

export async function createAssetSpec(input: AssetSpecInsertT): Promise<AssetSpec> {
  const supabase = createServiceClient();
  const payload = AssetSpecInsert.parse(input);
  const { data, error } = await supabase
    .from("asset_specs")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`createAssetSpec: ${error.message}`);
  return AssetSpec.parse(data);
}

export async function getAssetSpec(id: string): Promise<AssetSpec | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("asset_specs")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getAssetSpec: ${error.message}`);
  return data ? AssetSpec.parse(data) : null;
}
