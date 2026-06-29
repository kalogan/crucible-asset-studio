-- Projects-as-Games: promote `projects` to also be a portfolio entry (one record,
-- two non-overlapping faces). Portfolio face = presentation only, never read by the
-- generation pipeline. Identity (slug/name) + generation face (context_ref/cdn) exist.
alter table projects add column if not exists description text;
alter table projects add column if not exists status text not null default 'prototype'
  check (status in ('prototype', 'active', 'shipped', 'paused'));
alter table projects add column if not exists url text;       -- live/play URL
alter table projects add column if not exists repo_url text;
alter table projects add column if not exists screenshot text; -- hero image URL (not an upload)
