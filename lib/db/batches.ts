import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import {
  Batch,
  BatchInsert,
  type BatchInsert as BatchInsertT,
  type BatchStatus,
  type JobStatus,
} from "@/lib/schema";

export async function createBatch(input: BatchInsertT): Promise<Batch> {
  const supabase = createServiceClient();
  const payload = BatchInsert.parse(input);
  const { data, error } = await supabase
    .from("batches")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`createBatch: ${error.message}`);
  return Batch.parse(data);
}

export async function getBatch(id: string): Promise<Batch | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("batches")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getBatch: ${error.message}`);
  return data ? Batch.parse(data) : null;
}

export interface BatchUpdate {
  status?: BatchStatus;
  cost_actual?: number;
}

export async function updateBatch(id: string, patch: BatchUpdate): Promise<Batch> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("batches")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateBatch: ${error.message}`);
  return Batch.parse(data);
}

// ── monitor read helpers ─────────────────────────────────────────────────────

/** Per-status job counts for a batch (the monitor rollup) plus the total. */
export type JobRollup = Record<JobStatus, number> & { total: number };

/** A batch row joined with its job rollup — the monitor's per-batch view. */
export interface BatchWithRollup extends Batch {
  rollup: JobRollup;
}

function emptyRollup(): JobRollup {
  return { queued: 0, generating: 0, succeeded: 0, failed: 0, canceled: 0, total: 0 };
}

/**
 * The project's batches (newest first) each joined with a per-status job rollup. A single
 * round-trip — we pull the batches' jobs' statuses via the FK embed and tally them in JS,
 * so the monitor never N+1s. Error-tolerant: a query failure surfaces as an empty list
 * rather than a thrown page (matches the DAL's read posture elsewhere).
 */
export async function listBatchesByProject(projectId: string): Promise<BatchWithRollup[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("batches")
    .select("*, jobs(status)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`listBatchesByProject: ${error.message}`);

  type Row = Record<string, unknown> & { jobs?: { status: string }[] };
  return (data ?? []).map((raw) => {
    const r = raw as Row;
    const batch = Batch.parse(r);
    const rollup = emptyRollup();
    for (const j of Array.isArray(r.jobs) ? r.jobs : []) {
      const s = j.status as JobStatus;
      if (s in rollup) rollup[s] += 1;
      rollup.total += 1;
    }
    return { ...batch, rollup };
  });
}
