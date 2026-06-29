import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { Canon, CanonInsert, type CanonInsert as CanonInsertT } from "@/lib/schema";

export async function createCanon(input: CanonInsertT): Promise<Canon> {
  const supabase = createServiceClient();
  const payload = CanonInsert.parse(input);
  const { data, error } = await supabase
    .from("canons")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`createCanon: ${error.message}`);
  return Canon.parse(data);
}

export async function getCanon(id: string): Promise<Canon | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("canons")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getCanon: ${error.message}`);
  return data ? Canon.parse(data) : null;
}

export async function listCanonsByProject(projectId: string): Promise<Canon[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("canons")
    .select()
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listCanonsByProject: ${error.message}`);
  return (data ?? []).map((row) => Canon.parse(row));
}

/** The project's active canon (the first one — single-canon-per-project for now). */
export async function getCanonByProject(projectId: string): Promise<Canon | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("canons")
    .select()
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getCanonByProject: ${error.message}`);
  return data ? Canon.parse(data) : null;
}

export interface CanonUpdate {
  name?: string;
  style_guide?: Record<string, unknown>;
  prompt_prefix?: string;
  prompt_suffix?: string;
  negative_prompt?: string;
  reference_imgs?: unknown[];
  lora_ref?: string | null;
  lora_trigger?: string | null;
  lora_status?: "none" | "training" | "ready";
}

export async function updateCanon(id: string, patch: CanonUpdate): Promise<Canon> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("canons")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateCanon: ${error.message}`);
  return Canon.parse(data);
}
