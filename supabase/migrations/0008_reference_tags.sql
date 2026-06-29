-- Free-form hierarchy/origin tags for an imported reference asset (e.g. the source
-- pack/region "Skyhold" + category), captured at export time so the library can show
-- and filter by where an asset came from. The game itself is the project; tags add
-- the levels below it (region/pack, theme, category).
alter table reference_assets add column if not exists tags text[] not null default '{}';
