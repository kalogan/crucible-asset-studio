import { z } from "zod";

/**
 * Zod mirrors of the DB tables (supabase/migrations/0001_init.sql). These are the
 * single source of row shapes used across the app — DAL results are parsed through
 * them so we get runtime validation + inferred types without a generated Database.
 */

// ── enums ────────────────────────────────────────────────────────────────────
export const LoraStatus = z.enum(["none", "training", "ready"]);
export const AssetType = z.enum(["sprite", "texture", "model_3d", "icon", "avatar"]);
export const BatchStatus = z.enum([
  "queued", "running", "paused", "done", "failed", "canceled",
]);
export const JobStatus = z.enum([
  "queued", "generating", "succeeded", "failed", "canceled",
]);
export const AssetStage = z.enum([
  "queued", "generating", "in_review", "approved", "rejected", "finished", "published",
]);

export type LoraStatus = z.infer<typeof LoraStatus>;
export type AssetType = z.infer<typeof AssetType>;
export type BatchStatus = z.infer<typeof BatchStatus>;
export type JobStatus = z.infer<typeof JobStatus>;
export type AssetStage = z.infer<typeof AssetStage>;

const uuid = z.string().uuid();
const ts = z.string(); // timestamptz comes back as an ISO string

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case (a-z, 0-9, single hyphens)");

// ── projects ─────────────────────────────────────────────────────────────────
export const Project = z.object({
  id: uuid,
  slug: slugSchema,
  name: z.string().min(1),
  context_ref: z.string().nullable(),
  cdn_endpoint: z.string().nullable(),
  created_at: ts,
  updated_at: ts,
});
export type Project = z.infer<typeof Project>;

export const ProjectInsert = z.object({
  slug: slugSchema,
  name: z.string().min(1),
  context_ref: z.string().nullable().optional(),
  cdn_endpoint: z.string().nullable().optional(),
});
export type ProjectInsert = z.infer<typeof ProjectInsert>;

// ── canons ───────────────────────────────────────────────────────────────────
export const Canon = z.object({
  id: uuid,
  project_id: uuid,
  name: z.string().min(1),
  style_guide: z.record(z.unknown()),
  prompt_prefix: z.string(),
  prompt_suffix: z.string(),
  negative_prompt: z.string(),
  reference_imgs: z.array(z.unknown()),
  lora_ref: z.string().nullable(),
  lora_trigger: z.string().nullable(),
  lora_status: LoraStatus,
  created_at: ts,
  updated_at: ts,
});
export type Canon = z.infer<typeof Canon>;

export const CanonInsert = z.object({
  project_id: uuid,
  name: z.string().min(1),
  style_guide: z.record(z.unknown()).optional(),
  prompt_prefix: z.string().optional(),
  prompt_suffix: z.string().optional(),
  negative_prompt: z.string().optional(),
  reference_imgs: z.array(z.unknown()).optional(),
  lora_ref: z.string().nullable().optional(),
  lora_trigger: z.string().nullable().optional(),
  lora_status: LoraStatus.optional(),
});
export type CanonInsert = z.infer<typeof CanonInsert>;

// ── asset_specs ──────────────────────────────────────────────────────────────
export const AssetSpec = z.object({
  id: uuid,
  project_id: uuid,
  canon_id: uuid.nullable(),
  catalog_key: z.string().min(1),
  asset_type: AssetType,
  title: z.string().min(1),
  prompt: z.string(),
  params: z.record(z.unknown()),
  source_asset_id: uuid.nullable(),
  priority: z.number().int(),
  created_at: ts,
});
export type AssetSpec = z.infer<typeof AssetSpec>;

export const AssetSpecInsert = z.object({
  project_id: uuid,
  canon_id: uuid.nullable().optional(),
  catalog_key: z.string().min(1),
  asset_type: AssetType,
  title: z.string().min(1),
  prompt: z.string().optional(),
  params: z.record(z.unknown()).optional(),
  source_asset_id: uuid.nullable().optional(),
  priority: z.number().int().optional(),
});
export type AssetSpecInsert = z.infer<typeof AssetSpecInsert>;

// ── jobs ─────────────────────────────────────────────────────────────────────
export const Job = z.object({
  id: uuid,
  batch_id: uuid.nullable(),
  spec_id: uuid,
  status: JobStatus,
  attempt: z.number().int(),
  executor: z.string(),
  provider_ref: z.string().nullable(),
  recipe_snapshot: z.record(z.unknown()),
  error: z.string().nullable(),
  cost: z.number(),
  created_at: ts,
  updated_at: ts,
});
export type Job = z.infer<typeof Job>;

export const JobInsert = z.object({
  spec_id: uuid,
  batch_id: uuid.nullable().optional(),
  status: JobStatus.optional(),
  executor: z.string().optional(),
  provider_ref: z.string().nullable().optional(),
  recipe_snapshot: z.record(z.unknown()).optional(),
});
export type JobInsert = z.infer<typeof JobInsert>;

// ── assets ───────────────────────────────────────────────────────────────────
export const Asset = z.object({
  id: uuid,
  project_id: uuid,
  spec_id: uuid.nullable(),
  job_id: uuid.nullable(),
  stage: AssetStage,
  raw_path: z.string().nullable(),
  finished_path: z.string().nullable(),
  cdn_url: z.string().nullable(),
  recipe_snapshot: z.record(z.unknown()),
  created_at: ts,
  updated_at: ts,
});
export type Asset = z.infer<typeof Asset>;

export const AssetInsert = z.object({
  project_id: uuid,
  spec_id: uuid.nullable().optional(),
  job_id: uuid.nullable().optional(),
  stage: AssetStage.optional(),
  raw_path: z.string().nullable().optional(),
  finished_path: z.string().nullable().optional(),
  cdn_url: z.string().nullable().optional(),
  recipe_snapshot: z.record(z.unknown()).optional(),
});
export type AssetInsert = z.infer<typeof AssetInsert>;
