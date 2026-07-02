import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import {
  ReferenceAsset,
  ReferenceAssetInsert,
  type ReferenceAssetInsert as ReferenceAssetInsertT,
} from "@/lib/schema";

/**
 * Insert a reference asset as a NEW VERSION of its lineage (project_id + art_kit_id),
 * preserving history. Re-syncing the same art_kit_id no longer DELETES the prior row — it
 * demotes the lineage's rows to `is_current = false` and inserts the new one at
 * `version = max + 1, is_current = true`. Callers give each version a content-hashed
 * storage path (see `versionedStoragePath`) so the prior GLB survives too. Assets with a
 * null art_kit_id have no lineage → they're always version 1 / current (unchanged).
 */
export async function createReferenceAsset(
  input: ReferenceAssetInsertT,
): Promise<ReferenceAsset> {
  const supabase = createServiceClient();
  const payload = ReferenceAssetInsert.parse(input);

  let version = 1;
  if (payload.art_kit_id) {
    const { data: latest } = await supabase
      .from("reference_assets")
      .select("version")
      .eq("project_id", payload.project_id)
      .eq("art_kit_id", payload.art_kit_id)
      .order("version", { ascending: false })
      .limit(1);
    const maxV = (latest?.[0] as { version?: number } | undefined)?.version ?? 0;
    version = maxV + 1;
    if (maxV > 0) {
      // demote the previous current version(s) — the new row becomes current below
      await supabase
        .from("reference_assets")
        .update({ is_current: false })
        .eq("project_id", payload.project_id)
        .eq("art_kit_id", payload.art_kit_id);
    }
  }

  const { data, error } = await supabase
    .from("reference_assets")
    .insert({ ...payload, version, is_current: true })
    .select()
    .single();
  if (error) throw new Error(`createReferenceAsset: ${error.message}`);
  return ReferenceAsset.parse(data);
}

/** All versions of a lineage (project + art_kit_id), newest version first — for the modal flipper. */
export async function listAssetVersions(
  projectId: string,
  artKitId: string,
): Promise<ReferenceAsset[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("reference_assets")
    .select()
    .eq("project_id", projectId)
    .eq("art_kit_id", artKitId)
    .order("version", { ascending: false });
  if (error) throw new Error(`listAssetVersions: ${error.message}`);
  return (data ?? []).map((r) => ReferenceAsset.parse(r));
}

/** Promote an older version back to current (rollback) — demotes the rest of its lineage. */
export async function setCurrentVersion(id: string): Promise<void> {
  const supabase = createServiceClient();
  const asset = await getReferenceAsset(id);
  if (!asset || !asset.art_kit_id) return;
  await supabase
    .from("reference_assets")
    .update({ is_current: false })
    .eq("project_id", asset.project_id)
    .eq("art_kit_id", asset.art_kit_id);
  const { error } = await supabase
    .from("reference_assets")
    .update({ is_current: true })
    .eq("id", id);
  if (error) throw new Error(`setCurrentVersion: ${error.message}`);
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
    .eq("is_current", true) // default view = current version per lineage only
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
      .eq("is_current", true) // count current versions only (matches the visible Library)
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
      .eq("is_current", true) // global library shows current versions only
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`listAllReferenceAssets: ${error.message}`);
    const rows = (data ?? []).map((r) => ReferenceAsset.parse(r));
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}
