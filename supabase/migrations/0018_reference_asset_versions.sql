-- Asset versioning — keep HISTORY instead of delete-then-insert on re-import / re-rig.
--
-- A "lineage" = all reference_assets rows sharing (project_id, art_kit_id). Each row is a
-- VERSION; exactly one row per lineage is is_current. The default Library view shows only
-- is_current rows (so no clutter); the asset modal lists a lineage's versions to flip
-- through / compare. Storage stays unique per version via a CONTENT HASH in the object
-- path (set by the callers), so re-rigging never overwrites the prior GLB.
--
-- Backfill: existing rows default to version 1 / is_current true (each art_kit_id is
-- already unique after the earlier de-dupe), so this is a safe additive migration.
alter table reference_assets add column if not exists version int not null default 1;
alter table reference_assets add column if not exists is_current boolean not null default true;

create index if not exists reference_assets_lineage_idx
  on reference_assets (project_id, art_kit_id, version);
create index if not exists reference_assets_current_idx
  on reference_assets (project_id, is_current);
