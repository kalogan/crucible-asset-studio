-- Reference assets: renders of a game's EXISTING assets (e.g. procgen turntables
-- captured from the game's preview harness), imported to view/compare against
-- Crucible-generated assets and to seed LoRA training. No source file exists — the
-- harness renders the procgen mesh and pushes a PNG. art_kit_id lets a re-sync replace.
create table if not exists reference_assets (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  asset_type  text not null
              check (asset_type in ('character','creature','prop','fx','biome','ui','other')),
  label       text not null,
  source      text not null default 'procgen' check (source in ('procgen','external')),
  image_path  text not null,          -- public URL in storage
  art_kit_id  text,                   -- the game's id, for re-sync dedupe
  created_at  timestamptz not null default now()
);
create index if not exists reference_assets_project_id_idx on reference_assets(project_id);
create index if not exists reference_assets_type_idx on reference_assets(project_id, asset_type);
