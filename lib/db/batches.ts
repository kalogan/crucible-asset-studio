import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import {
  Batch,
  BatchInsert,
  type BatchInsert as BatchInsertT,
  type BatchStatus,
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
