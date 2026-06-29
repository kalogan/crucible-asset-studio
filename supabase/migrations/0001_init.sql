-- Crucible — initial schema (multi-game from line one).
-- Single-user, no RLS (HANDOFF_crucible.md §4). `project` is first-class; every
-- downstream record hangs off it. Lifecycle:
--   queued -> generating -> in_review -> approved -> finished (Kiln) -> published (CDN)
--   rejected -> re-queue

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ── updated_at trigger helper ────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── projects ─────────────────────────────────────────────────────────────────
create table if not exists projects (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,                 -- "wayfinders", "deception-station"
  name         text not null,
  context_ref  text,                                 -- repo URL / design-doc path used for intake
  cdn_endpoint text,                                 -- per-project CDN base URL
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint projects_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
create trigger projects_set_updated_at before update on projects
  for each row execute function set_updated_at();

-- ── canons (the core domain object: per-game style + LoRA) ───────────────────
create table if not exists canons (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  name            text not null,                      -- "Wayfinders core", "noir station"
  style_guide     jsonb not null default '{}'::jsonb, -- palette, rendering conventions, do/don'ts
  prompt_prefix   text not null default '',
  prompt_suffix   text not null default '',
  negative_prompt text not null default '',
  reference_imgs  jsonb not null default '[]'::jsonb,
  lora_ref        text,                               -- trained LoRA file/version
  lora_trigger    text,
  lora_status     text not null default 'none'
                  check (lora_status in ('none','training','ready')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists canons_project_id_idx on canons(project_id);
create trigger canons_set_updated_at before update on canons
  for each row execute function set_updated_at();

-- ── asset_specs (what to generate — the plan) ────────────────────────────────
create table if not exists asset_specs (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  canon_id        uuid references canons(id) on delete set null,
  catalog_key     text not null,                      -- "prop.station.ticket_booth"
  asset_type      text not null
                  check (asset_type in ('sprite','texture','model_3d','icon','avatar')),
  title           text not null,
  prompt          text not null default '',
  params          jsonb not null default '{}'::jsonb,
  source_asset_id uuid, -- 2D->3D chaining; FK to assets added after assets exists (below)
  priority        int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists asset_specs_project_id_idx on asset_specs(project_id);
create index if not exists asset_specs_canon_id_idx on asset_specs(canon_id);

-- ── batches ──────────────────────────────────────────────────────────────────
create table if not exists batches (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  name          text not null,
  status        text not null default 'queued'
                check (status in ('queued','running','paused','done','failed','canceled')),
  cost_estimate numeric(10,4) not null default 0,
  cost_actual   numeric(10,4) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists batches_project_id_idx on batches(project_id);
create trigger batches_set_updated_at before update on batches
  for each row execute function set_updated_at();

-- ── jobs ─────────────────────────────────────────────────────────────────────
-- recipe_snapshot freezes model+prompt+seed+params+lora for reproducibility.
create table if not exists jobs (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid references batches(id) on delete cascade,
  spec_id         uuid not null references asset_specs(id) on delete cascade,
  status          text not null default 'queued'
                  check (status in ('queued','generating','succeeded','failed','canceled')),
  attempt         int not null default 0,
  executor        text not null default 'replicate',
  provider_ref    text,                                -- e.g. Replicate prediction id
  recipe_snapshot jsonb not null default '{}'::jsonb,
  error           text,
  cost            numeric(10,4) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists jobs_spec_id_idx on jobs(spec_id);
create index if not exists jobs_batch_id_idx on jobs(batch_id);
create trigger jobs_set_updated_at before update on jobs
  for each row execute function set_updated_at();

-- ── assets (produced asset moving through lifecycle) ─────────────────────────
create table if not exists assets (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  spec_id         uuid references asset_specs(id) on delete set null,
  job_id          uuid references jobs(id) on delete set null,
  stage           text not null default 'in_review'
                  check (stage in ('queued','generating','in_review','approved','rejected','finished','published')),
  raw_path        text,                                -- generation output (2D image / raw mesh)
  finished_path   text,                                -- Kiln output
  cdn_url         text,                                -- after publish
  recipe_snapshot jsonb not null default '{}'::jsonb,  -- full reproducibility (incl. canon + lora version)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists assets_project_id_idx on assets(project_id);
create index if not exists assets_spec_id_idx on assets(spec_id);
create index if not exists assets_stage_idx on assets(stage);
create trigger assets_set_updated_at before update on assets
  for each row execute function set_updated_at();

-- asset_specs.source_asset_id references assets, declared after assets exists.
alter table asset_specs
  drop constraint if exists asset_specs_source_asset_id_fkey;
alter table asset_specs
  add constraint asset_specs_source_asset_id_fkey
  foreign key (source_asset_id) references assets(id) on delete set null;
