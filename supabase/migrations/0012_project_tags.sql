-- Display tags for the dashboard cards: a granular type label + tech + genre arrays.
-- Idempotent.
alter table projects add column if not exists type text;
alter table projects add column if not exists tech text[] not null default '{}';
alter table projects add column if not exists genres text[] not null default '{}';
