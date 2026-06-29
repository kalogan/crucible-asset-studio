-- An asset is now either a 2D 'image' (awaiting optional promotion to 3D) or a
-- finished 3D 'model'. Lets the user review/edit a cheap FLUX image before paying
-- for the expensive TRELLIS 3D step. Existing rows default to 'model'.
alter table assets add column if not exists kind text not null default 'model'
  check (kind in ('image', 'model'));
