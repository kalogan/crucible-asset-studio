-- Asset systems: a reusable bundle of library assets (+ optional lights / fx /
-- sound refs + params) saved as ONE unit — e.g. a campfire = logs mesh + flame
-- fx + point light + crackle sound. The bundle lives in `manifest` (jsonb) so it
-- can grow without further migrations.
create table if not exists asset_systems (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  description text,
  manifest jsonb not null default '{"parts":[]}',
  created_at timestamptz not null default now()
);
