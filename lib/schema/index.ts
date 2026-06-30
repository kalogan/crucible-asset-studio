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
export const AssetKind = z.enum(["image", "model"]);
export type AssetKind = z.infer<typeof AssetKind>;

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

// ── projects (one record, two faces: identity + portfolio + generation) ──────
export const ProjectStatus = z.enum(["prototype", "active", "shipped", "paused"]);
export type ProjectStatus = z.infer<typeof ProjectStatus>;

/** A project is a game (asset-gen workspace) or an app (portfolio + lighter tooling). */
export const ProjectKind = z.enum(["game", "app"]);
export type ProjectKind = z.infer<typeof ProjectKind>;

export const Project = z.object({
  // identity
  id: uuid,
  slug: slugSchema,
  name: z.string().min(1),
  // catch keeps an unexpected value from 500ing the gallery (defaults to game).
  kind: ProjectKind.catch("game"),
  // portfolio face (presentation only)
  description: z.string().nullable(),
  status: ProjectStatus,
  url: z.string().nullable(),
  repo_url: z.string().nullable(),
  screenshot: z.string().nullable(),
  // non-destructive hero focal point (0..1); the card/hero frame around it.
  screenshot_focal_x: z.number().catch(0.5),
  screenshot_focal_y: z.number().catch(0.5),
  // display tags (dashboard cards): a granular type label + tech + genre lists.
  type: z.string().nullable().catch(null),
  tech: z.array(z.string()).catch([]),
  genres: z.array(z.string()).catch([]),
  // GitHub repo last-update, stored (by the import script) so the dashboard reads it
  // from the DB instead of live-fetching GitHub on every render.
  github_pushed_at: z.string().nullable().catch(null),
  // generation face
  context_ref: z.string().nullable(),
  cdn_endpoint: z.string().nullable(),
  created_at: ts,
  updated_at: ts,
});
export type Project = z.infer<typeof Project>;

export const ProjectInsert = z.object({
  slug: slugSchema,
  name: z.string().min(1),
  kind: ProjectKind.optional(),
  description: z.string().nullable().optional(),
  status: ProjectStatus.optional(),
  url: z.string().nullable().optional(),
  repo_url: z.string().nullable().optional(),
  screenshot: z.string().nullable().optional(),
  context_ref: z.string().nullable().optional(),
  cdn_endpoint: z.string().nullable().optional(),
});
export type ProjectInsert = z.infer<typeof ProjectInsert>;

/** Portfolio-face edits only (the generation face is never edited here). */
export const ProjectUpdate = z.object({
  description: z.string().nullable().optional(),
  status: ProjectStatus.optional(),
  kind: ProjectKind.optional(),
  url: z.string().nullable().optional(),
  repo_url: z.string().nullable().optional(),
  screenshot: z.string().nullable().optional(),
  screenshot_focal_x: z.number().optional(),
  screenshot_focal_y: z.number().optional(),
  type: z.string().nullable().optional(),
  tech: z.array(z.string()).optional(),
  genres: z.array(z.string()).optional(),
  github_pushed_at: z.string().nullable().optional(),
});
export type ProjectUpdate = z.infer<typeof ProjectUpdate>;

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

// ── reference_assets (a game's existing/procgen assets, imported as renders) ──
export const ReferenceAssetType = z.enum([
  "character", "creature", "prop", "fx", "biome", "ui", "other",
]);
export type ReferenceAssetType = z.infer<typeof ReferenceAssetType>;

export const ReferenceAsset = z.object({
  id: uuid,
  project_id: uuid,
  asset_type: ReferenceAssetType,
  label: z.string().min(1),
  source: z.enum(["procgen", "external"]),
  format: z.enum(["image", "model"]).default("image"),
  image_path: z.string(),
  art_kit_id: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  notes: z.string().default(""),
  created_at: ts,
});
export type ReferenceAsset = z.infer<typeof ReferenceAsset>;

export const ReferenceAssetInsert = z.object({
  project_id: uuid,
  asset_type: ReferenceAssetType,
  label: z.string().min(1),
  source: z.enum(["procgen", "external"]).optional(),
  format: z.enum(["image", "model"]).optional(),
  image_path: z.string(),
  art_kit_id: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});
export type ReferenceAssetInsert = z.infer<typeof ReferenceAssetInsert>;

// ── jobs ─────────────────────────────────────────────────────────────────────
export const GenerationPhase = z.enum(["image", "cutout", "model", "saving"]);
export type GenerationPhase = z.infer<typeof GenerationPhase>;

export const Job = z.object({
  id: uuid,
  batch_id: uuid.nullable(),
  spec_id: uuid,
  status: JobStatus,
  phase: GenerationPhase.nullable().optional(),
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
  kind: AssetKind.default("model"),
  raw_path: z.string().nullable(),
  finished_path: z.string().nullable(),
  cdn_url: z.string().nullable(),
  recipe_snapshot: z.record(z.unknown()),
  notes: z.string().default(""),
  created_at: ts,
  updated_at: ts,
});
export type Asset = z.infer<typeof Asset>;

export const AssetInsert = z.object({
  project_id: uuid,
  spec_id: uuid.nullable().optional(),
  job_id: uuid.nullable().optional(),
  stage: AssetStage.optional(),
  kind: AssetKind.optional(),
  raw_path: z.string().nullable().optional(),
  finished_path: z.string().nullable().optional(),
  cdn_url: z.string().nullable().optional(),
  recipe_snapshot: z.record(z.unknown()).optional(),
});
export type AssetInsert = z.infer<typeof AssetInsert>;
