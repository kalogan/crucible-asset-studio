import { z } from "zod";

/**
 * An "asset system" bundles several library assets (+ optional lights / fx /
 * sound refs + params) into ONE reusable unit — e.g. a campfire = logs mesh +
 * flame fx + point light + crackle sound. The bundle is described by a
 * `manifest` (jsonb on the row) so the schema can grow without migrations.
 *
 * Mirrors the Zod-row style in lib/schema/index.ts: the DB row + an Insert
 * shape, both parsed at the DAL boundary for runtime validation.
 */

const uuid = z.string().uuid();
const ts = z.string(); // timestamptz comes back as an ISO string

const vec3 = z.tuple([z.number(), z.number(), z.number()]);

/** One placed part of the system — a library asset positioned in local space. */
export const ManifestPart = z.object({
  assetId: z.string().min(1),
  role: z.string().optional(),
  position: vec3.default([0, 0, 0]),
  rotation: vec3.default([0, 0, 0]),
  scale: z.number().default(1),
});
export type ManifestPart = z.infer<typeof ManifestPart>;

/** Optional light ref (editor UI is a future step; schema-ready, default empty). */
export const ManifestLight = z.object({
  type: z.enum(["point", "directional", "ambient"]),
  color: z.string(),
  intensity: z.number(),
  position: vec3.optional(),
});
export type ManifestLight = z.infer<typeof ManifestLight>;

/** Optional sound ref. A `url` points at a baked audio asset (see AudioRecipe below). */
export const ManifestSound = z.object({
  label: z.string(),
  url: z.string().optional(),
});
export type ManifestSound = z.infer<typeof ManifestSound>;

/**
 * A serializable synth recipe the Director authors in the sounds editor, then bakes to a
 * stored WAV via lib/pipeline/audio's bakeAudioAsset. Mirrors that module's TS `AudioRecipe`
 * interface, but re-expressed as Zod so the bake server action can validate what the client
 * sends at the boundary (the pipeline exports only a TS type, not a runtime validator).
 */
export const AudioWave = z.enum(["sine", "square", "sawtooth", "triangle"]);
export type AudioWave = z.infer<typeof AudioWave>;

export const AudioEvent = z.object({
  type: z.enum(["tone", "noise"]),
  freq: z.number().optional(),
  startSec: z.number().min(0),
  durationSec: z.number().min(0),
  gain: z.number().min(0).max(1),
  wave: AudioWave.optional(),
});
export type AudioEvent = z.infer<typeof AudioEvent>;

export const AudioRecipe = z.object({
  sampleRate: z.number().int().positive(),
  masterGain: z.number().min(0).max(1).optional(),
  events: z.array(AudioEvent),
});
export type AudioRecipe = z.infer<typeof AudioRecipe>;

/**
 * Optional FX ref — a named effect (e.g. "fire", "smoke") with free-form params.
 * Editor v1 edits `kind` only; a `params` editor + scene rendering are future steps.
 */
export const ManifestFx = z.object({
  kind: z.string(),
  params: z.record(z.unknown()).optional(),
});
export type ManifestFx = z.infer<typeof ManifestFx>;

export const Manifest = z.object({
  parts: z.array(ManifestPart).default([]),
  lights: z.array(ManifestLight).optional(),
  sounds: z.array(ManifestSound).optional(),
  fx: z.array(ManifestFx).optional(),
  params: z.record(z.unknown()).optional(),
});
export type Manifest = z.infer<typeof Manifest>;

/** Default manifest for an empty system. */
export const defaultManifest: Manifest = { parts: [] };

export const AssetSystem = z.object({
  id: uuid,
  project_id: uuid,
  name: z.string().min(1),
  description: z.string().nullable(),
  manifest: Manifest,
  created_at: ts,
});
export type AssetSystem = z.infer<typeof AssetSystem>;

export const AssetSystemInsert = z.object({
  project_id: uuid,
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  manifest: Manifest.optional(),
});
export type AssetSystemInsert = z.infer<typeof AssetSystemInsert>;
