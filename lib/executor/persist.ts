import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * KERNEL_LESSONS §6: provider output URLs (Replicate) are temporary — fetch and
 * re-upload to durable Storage the moment a job succeeds. Upsert keeps retries/
 * resumes idempotent.
 */
export const STORAGE_BUCKET = "assets";

export interface PersistInput {
  sourceUrl: string;
  /** storage path, e.g. "wayfinders/prop.station.ticket_booth.glb" */
  path: string;
  contentType: string;
}

export async function persistToStorage({
  sourceUrl,
  path,
  contentType,
}: PersistInput): Promise<string> {
  const supabase = createServiceClient();

  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`persistToStorage: failed to fetch source (${res.status})`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { upsert: true, contentType });
  if (error) throw new Error(`persistToStorage: upload failed — ${error.message}`);

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Persist raw base64 image bytes (e.g. Gemini/nano-banana inline output) to Storage. */
export async function persistBase64ToStorage({
  base64,
  mimeType,
  path,
}: {
  base64: string;
  mimeType: string;
  path: string;
}): Promise<string> {
  const supabase = createServiceClient();
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { upsert: true, contentType: mimeType });
  if (error) throw new Error(`persistBase64ToStorage: upload failed — ${error.message}`);
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Pick a storage extension from a content type. */
export function extForContentType(contentType: string): string {
  if (contentType.includes("gltf-binary") || contentType.includes("glb")) return "glb";
  if (contentType === "model/gltf+json") return "gltf";
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  if (contentType === "audio/wav" || contentType === "audio/x-wav") return "wav";
  if (contentType === "audio/mpeg") return "mp3";
  if (contentType === "audio/mp4") return "m4a";
  if (contentType === "audio/ogg") return "ogg";
  return "png";
}
