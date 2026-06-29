import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET, extForContentType } from "@/lib/executor";

/**
 * Upload a portfolio hero image to Supabase Storage and return its public URL.
 * Timestamped filename so re-uploads don't serve a stale cached image.
 */
export async function uploadProjectScreenshot(
  projectSlug: string,
  bytes: Uint8Array,
  contentType: string,
  stamp: number,
): Promise<string> {
  const supabase = createServiceClient();
  const ext = extForContentType(contentType);
  const path = `${projectSlug}/portfolio/hero-${stamp}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { upsert: true, contentType });
  if (error) throw new Error(`uploadProjectScreenshot: ${error.message}`);
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}
