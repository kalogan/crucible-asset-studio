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
