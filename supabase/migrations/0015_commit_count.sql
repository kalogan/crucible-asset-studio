-- Per-repo commit count (default branch), stored by refresh-github so the dashboard
-- shows total commits from the DB. Idempotent.
alter table projects add column if not exists commit_count integer;
