-- Reference assets can be a 2D 'image' (PNG capture) or a 'model' (GLB exported from
-- the harness via GLTFExporter) — the latter renders live/orbitable in the viewer.
alter table reference_assets add column if not exists format text not null default 'image'
  check (format in ('image', 'model'));
