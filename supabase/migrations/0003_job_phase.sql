-- Add a coarse progress phase to jobs so the UI can show a live stage indicator
-- (image -> cutout -> model -> saving). Nullable; older rows stay null.
alter table jobs add column if not exists phase text;
