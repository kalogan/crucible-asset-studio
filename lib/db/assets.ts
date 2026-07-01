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
  kind?: "image" | "model" | "audio";
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

/**
 * All assets across every project (newest first) — for the global library. Pages through in
 * 1000-row chunks (PostgREST caps a single response at ~1000) so nothing is silently dropped;
 * `max` is a runaway safety cap, not the display limit.
 */
export async function listAllAssets(max = 20000): Promise<Asset[]> {
  const supabase = createServiceClient();
  const PAGE = 1000;
  const out: Asset[] = [];
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await supabase
      .from("assets")
      .select()
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`listAllAssets: ${error.message}`);
    const rows = (data ?? []).map((row) => Asset.parse(row));
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/**
 * Count assets grouped by project, in one query (for the dashboard). Tolerant — returns an
 * empty map on error so the dashboard renders even if the assets table is unavailable.
 */
export async function assetCountsByProject(): Promise<Record<string, number>> {
  const supabase = createServiceClient();
  const counts: Record<string, number> = {};
  const PAGE = 1000;
  // Page through (PostgREST caps a single response at ~1000) so the tally isn't truncated.
  // Match the Library's total: it excludes rejected assets, so this count must too.
  for (let from = 0; from < 200000; from += PAGE) {
    const { data, error } = await supabase
      .from("assets")
      .select("project_id")
      .neq("stage", "rejected")
      .range(from, from + PAGE - 1);
    if (error) {
      console.warn("assetCountsByProject failed:", error.message);
      return counts;
    }
    const rows = data ?? [];
    for (const row of rows) {
      const pid = (row as { project_id?: string }).project_id;
      if (typeof pid === "string") counts[pid] = (counts[pid] ?? 0) + 1;
    }
    if (rows.length < PAGE) break;
  }
  return counts;
}
