-- Director's notes on an asset (free text, editable in the library focus view).
-- Both asset sources get it: imported references and generated assets.
alter table reference_assets add column if not exists notes text not null default '';
alter table assets add column if not exists notes text not null default '';
