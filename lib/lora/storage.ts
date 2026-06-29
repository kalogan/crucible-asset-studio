import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET } from "@/lib/executor";

/** Training images live at `<project-slug>/training/<filename>` in the assets bucket. */
function trainingDir(projectSlug: string): string {
  return `${projectSlug}/training`;
}

export interface TrainingImage {
  name: string;
  url: string;
}

export async function listTrainingImages(projectSlug: string): Promise<TrainingImage[]> {
  const supabase = createServiceClient();
  const dir = trainingDir(projectSlug);
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(dir, { limit: 200, sortBy: { column: "name", order: "asc" } });
  if (error) throw new Error(`listTrainingImages: ${error.message}`);
  return (data ?? [])
    .filter((f) => f.name && !f.name.startsWith("."))
    .map((f) => ({
      name: f.name,
      url: supabase.storage.from(STORAGE_BUCKET).getPublicUrl(`${dir}/${f.name}`).data.publicUrl,
    }));
}

export async function uploadTrainingImage(
  projectSlug: string,
  name: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const supabase = createServiceClient();
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(`${trainingDir(projectSlug)}/${safe}`, bytes, { upsert: true, contentType });
  if (error) throw new Error(`uploadTrainingImage: ${error.message}`);
}

export async function removeTrainingImage(projectSlug: string, name: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([`${trainingDir(projectSlug)}/${name}`]);
  if (error) throw new Error(`removeTrainingImage: ${error.message}`);
}
