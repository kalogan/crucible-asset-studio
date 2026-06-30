-- Project kind discriminator (game | app) + a non-destructive hero focal point.
-- Idempotent: safe to re-run.
alter table projects add column if not exists kind text not null default 'game';
alter table projects
  add column if not exists screenshot_focal_x real not null default 0.5;
alter table projects
  add column if not exists screenshot_focal_y real not null default 0.5;
