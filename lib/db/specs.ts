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

export interface SpecWithAsset {
  id: string;
  title: string;
  prompt: string;
  created_at: string;
  thumbPath: string | null; // latest asset's image url, if it's a 2D image
  assetKind: "image" | "model" | null;
}

/** The project's prompt history (newest first) for the prompt library. */
export async function listSpecsWithAssetByProject(
  projectId: string,
): Promise<SpecWithAsset[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("asset_specs")
    .select("id,title,prompt,created_at,assets(raw_path,kind,created_at)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(`listSpecsWithAssetByProject: ${error.message}`);

  type Row = {
    id: string;
    title: string;
    prompt: string;
    created_at: string;
    assets?: { raw_path: string | null; kind: string; created_at: string }[];
  };
  return (data ?? []).map((raw) => {
    const r = raw as Row;
    const assets = Array.isArray(r.assets)
      ? [...r.assets].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      : [];
    const latest = assets[0] ?? null;
    return {
      id: r.id,
      title: r.title,
      prompt: r.prompt,
      created_at: r.created_at,
      thumbPath: latest && latest.kind === "image" ? latest.raw_path : null,
      assetKind: latest ? (latest.kind === "image" ? "image" : "model") : null,
    };
  });
}
