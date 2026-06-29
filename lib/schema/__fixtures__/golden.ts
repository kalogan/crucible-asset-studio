/**
 * Golden fixtures — one fully-populated row per table, shaped exactly as Supabase
 * returns it. The schema test parses each through its Zod mirror, locking the
 * row contract. Update these deliberately alongside any migration change.
 */
export const goldenProject = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "wayfinders",
  name: "Wayfinders",
  description: "Cozy faceted low-poly MMORPG.",
  status: "active",
  url: "https://wayfinders.example.com",
  repo_url: "https://github.com/kalogan/wayfinders",
  screenshot: "https://cdn.example.com/wayfinders/hero.png",
  context_ref: "https://github.com/kalogan/wayfinders",
  cdn_endpoint: "https://cdn.example.com/wayfinders",
  created_at: "2026-06-28T00:00:00.000Z",
  updated_at: "2026-06-28T00:00:00.000Z",
};

export const goldenCanon = {
  id: "22222222-2222-4222-8222-222222222222",
  project_id: goldenProject.id,
  name: "Wayfinders core",
  style_guide: { palette: { primary: "#c98a3a" }, render: "faceted low-poly" },
  prompt_prefix: "wyfndrstyle, faceted low-poly, flat-shaded",
  prompt_suffix: "3/4 view, plain background",
  negative_prompt: "photorealistic, PBR, grimdark",
  reference_imgs: ["https://example.com/ref1.png"],
  lora_ref: null,
  lora_trigger: "wyfndrstyle",
  lora_status: "none",
  created_at: "2026-06-28T00:00:00.000Z",
  updated_at: "2026-06-28T00:00:00.000Z",
};

export const goldenAssetSpec = {
  id: "33333333-3333-4333-8333-333333333333",
  project_id: goldenProject.id,
  canon_id: goldenCanon.id,
  catalog_key: "prop.station.ticket_booth",
  asset_type: "model_3d",
  title: "Ticket booth",
  prompt: "a wooden ticket booth, isolated object, neutral background",
  params: { width: 1024 },
  source_asset_id: null,
  priority: 0,
  created_at: "2026-06-28T00:00:00.000Z",
};

export const goldenJob = {
  id: "44444444-4444-4444-8444-444444444444",
  batch_id: null,
  spec_id: goldenAssetSpec.id,
  status: "succeeded",
  phase: null,
  attempt: 1,
  executor: "replicate",
  provider_ref: "pred_abc123",
  recipe_snapshot: { model: "black-forest-labs/flux-schnell", seed: 0 },
  error: null,
  cost: 0.085,
  created_at: "2026-06-28T00:00:00.000Z",
  updated_at: "2026-06-28T00:00:00.000Z",
};

export const goldenAsset = {
  id: "55555555-5555-4555-8555-555555555555",
  project_id: goldenProject.id,
  spec_id: goldenAssetSpec.id,
  job_id: goldenJob.id,
  stage: "in_review",
  kind: "model",
  raw_path: "wayfinders/prop.station.ticket_booth.glb",
  finished_path: null,
  cdn_url: null,
  recipe_snapshot: { model: "firtoz/trellis", lora_ref: null },
  created_at: "2026-06-28T00:00:00.000Z",
  updated_at: "2026-06-28T00:00:00.000Z",
};
