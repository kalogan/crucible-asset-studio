-- Store the repo's GitHub last-update so the dashboard reads it from the DB (populated by
-- the import script) instead of live-fetching GitHub on every render. Idempotent.
alter table projects add column if not exists github_pushed_at timestamptz;
