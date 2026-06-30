-- Audio becomes a first-class AssetKind: the procgen synth recipe is baked to a WAV
-- and stored like any other asset. The original CHECK constraints (0004, 0007) only
-- allowed 'image' | 'model', so widen both to also permit 'audio'. Idempotent:
-- drop-if-exists then re-add (Postgres auto-named the inline constraints).
alter table assets drop constraint if exists assets_kind_check;
alter table assets add constraint assets_kind_check
  check (kind in ('image', 'model', 'audio'));

alter table reference_assets drop constraint if exists reference_assets_format_check;
alter table reference_assets add constraint reference_assets_format_check
  check (format in ('image', 'model', 'audio'));
