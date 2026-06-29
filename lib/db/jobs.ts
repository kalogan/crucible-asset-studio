import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { Job, JobInsert, type JobInsert as JobInsertT, type JobStatus } from "@/lib/schema";

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
  attempt?: number;
  provider_ref?: string | null;
  recipe_snapshot?: Record<string, unknown>;
  error?: string | null;
  cost?: number;
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
