import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { Job, JobInsert, type JobInsert as JobInsertT, type JobStatus } from "@/lib/schema";

/** Re-claim a job whose `generating` lock is older than this — its runner likely crashed. */
const STALE_CLAIM_MS = 10 * 60 * 1000;

export async function createJob(input: JobInsertT): Promise<Job> {
  const supabase = createServiceClient();
  const payload = JobInsert.parse(input);
  const { data, error } = await supabase
    .from("jobs")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`createJob: ${error.message}`);
  return Job.parse(data);
}

export interface JobUpdate {
  status?: JobStatus;
  phase?: string | null;
  attempt?: number;
  provider_ref?: string | null;
  recipe_snapshot?: Record<string, unknown>;
  error?: string | null;
  cost?: number;
  started_at?: string | null;
}

export async function updateJob(id: string, patch: JobUpdate): Promise<Job> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("jobs")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateJob: ${error.message}`);
  return Job.parse(data);
}

/** All jobs created at/after `sinceIso` — the daily-spend proxy (count × estimate). */
export async function countJobsSince(sinceIso: string): Promise<number> {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sinceIso);
  if (error) throw new Error(`countJobsSince: ${error.message}`);
  return count ?? 0;
}

/** Latest still-`generating` job (phase + start) — drives the live status indicator. */
export async function getLatestGeneratingJob(): Promise<{
  phase: string | null;
  created_at: string;
} | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("phase,created_at")
    .eq("status", "generating")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestGeneratingJob: ${error.message}`);
  return (data as { phase: string | null; created_at: string } | null) ?? null;
}

/** Jobs still `generating` since `sinceIso` — the single-in-flight guard. */
export async function countActiveJobsSince(sinceIso: string): Promise<number> {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "generating")
    .gte("created_at", sinceIso);
  if (error) throw new Error(`countActiveJobsSince: ${error.message}`);
  return count ?? 0;
}

// ── batch-worker queue helpers ───────────────────────────────────────────────

export async function getJob(id: string): Promise<Job | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("jobs")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getJob: ${error.message}`);
  return data ? Job.parse(data) : null;
}

/** Every job in a batch, oldest first — the worker's view of the queue. */
export async function listJobsByBatch(batchId: string): Promise<Job[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("jobs")
    .select()
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listJobsByBatch: ${error.message}`);
  return (data ?? []).map((row) => Job.parse(row));
}

/**
 * Atomically claim a job for execution (queued -> generating). The whole point of the
 * resumable worker: the update is GUARDED to only flip rows that are still claimable, so
 * re-running a batch never re-runs a `succeeded` job (no double-charge) and two runners
 * can't both grab the same job. Claimable =
 *   - `queued`  (never run yet),
 *   - `failed`  (a prior attempt errored — resume retries it; `attempt` increments),
 *   - `generating` but STALE (started_at older than STALE_CLAIM_MS — runner crashed mid-flight).
 * NOT claimable: `succeeded` / `canceled` (terminal) or a fresh `generating` lock (in flight).
 * Returns the claimed Job, or null if nothing was claimable.
 */
export async function claimQueuedJob(id: string): Promise<Job | null> {
  const supabase = createServiceClient();
  const current = await getJob(id);
  if (!current) return null;

  const isQueued = current.status === "queued";
  const isRetryable = current.status === "failed";
  const isStale =
    current.status === "generating" &&
    current.started_at != null &&
    Date.now() - new Date(current.started_at).getTime() > STALE_CLAIM_MS;
  if (!isQueued && !isRetryable && !isStale) return null;

  // Guard the write on the status we just read so a concurrent claim loses the race
  // (its .eq("status", …) matches zero rows and returns no data).
  const { data, error } = await supabase
    .from("jobs")
    .update({
      status: "generating",
      attempt: current.attempt + 1,
      started_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", id)
    .eq("status", current.status)
    .select()
    .maybeSingle();
  if (error) throw new Error(`claimQueuedJob: ${error.message}`);
  return data ? Job.parse(data) : null;
}
