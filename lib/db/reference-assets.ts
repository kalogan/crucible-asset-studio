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

export async function getReferenceAsset(id: string): Promise<ReferenceAsset | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("reference_assets")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getReferenceAsset: ${error.message}`);
  return data ? ReferenceAsset.parse(data) : null;
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

/**
 * Count reference (procgen/imported) assets grouped by project, in one query. Tolerant —
 * returns an empty map on error so the dashboard renders even if the table is unavailable.
 */
export async function referenceCountsByProject(): Promise<Record<string, number>> {
  const supabase = createServiceClient();
  const counts: Record<string, number> = {};
  const PAGE = 1000;
  // Page through (PostgREST caps a single response at ~1000) so the tally isn't truncated.
  for (let from = 0; from < 200000; from += PAGE) {
    const { data, error } = await supabase
      .from("reference_assets")
      .select("project_id")
      .range(from, from + PAGE - 1);
    if (error) {
      console.warn("referenceCountsByProject failed:", error.message);
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

/**
 * All reference (procgen/imported) assets across every project (newest first) — for the global
 * library. Pages through in 1000-row chunks (PostgREST caps a single response at ~1000) so
 * nothing is silently dropped; `max` is a runaway safety cap, not the display limit.
 */
export async function listAllReferenceAssets(max = 20000): Promise<ReferenceAsset[]> {
  const supabase = createServiceClient();
  const PAGE = 1000;
  const out: ReferenceAsset[] = [];
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await supabase
      .from("reference_assets")
      .select()
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`listAllReferenceAssets: ${error.message}`);
    const rows = (data ?? []).map((r) => ReferenceAsset.parse(r));
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}
