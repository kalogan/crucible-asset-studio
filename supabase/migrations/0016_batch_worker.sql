-- Resumable batch worker (Phase 3, slice 1). The batches/jobs tables already carry
-- status + attempt + cost (0001_init.sql); this adds the small bookkeeping columns the
-- re-entrant worker needs. Idempotent (add column if not exists) — safe to re-run.

-- `dry_run` marks a batch that was run in mock mode (no Replicate/Anthropic spend) so a
-- mock run is never mistaken for a real one in the cost ledger.
alter table batches
  add column if not exists dry_run boolean not null default false;

-- `started_at` stamps when a job was claimed (queued -> generating). Lets the worker spot
-- a stale claim from a crashed run (generating but started long ago) and safely re-claim it.
alter table jobs
  add column if not exists started_at timestamptz;

-- Re-entrant claiming and queue draining both scan by (batch_id, status); index it.
create index if not exists jobs_batch_status_idx on jobs(batch_id, status);
