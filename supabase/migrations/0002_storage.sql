-- Public storage bucket for generated assets (raw images, GLBs, finished output).
-- Single-user: uploads go through the service role (bypasses RLS); public reads
-- give the stable URLs games/preview fetch. Move to R2/CDN at Phase 3 if needed.
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;
