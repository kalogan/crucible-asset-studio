-- A synthesized README blurb, stored so Creations reads it from the DB (populated by
-- refresh-github) instead of live-fetching GitHub on every render. Idempotent.
alter table projects add column if not exists summary text;
