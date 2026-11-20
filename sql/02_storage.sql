-- =====================================================================
-- 02_storage.sql — logo storage (run after 01_schema.sql)
-- Logos are public images; only the centre owner can upload/replace.
-- Path format: <centre_id>/logo-<timestamp>.png
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 524288, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy "logo read" on storage.objects for select using (bucket_id = 'logos');

create policy "logo upload by owner" on storage.objects for insert to authenticated
with check (bucket_id = 'logos' and exists (
  select 1 from public.centres c where c.id::text = (storage.foldername(name))[1] and c.owner_id = auth.uid()));

create policy "logo update by owner" on storage.objects for update to authenticated
using (bucket_id = 'logos' and exists (
  select 1 from public.centres c where c.id::text = (storage.foldername(name))[1] and c.owner_id = auth.uid()));

create policy "logo delete by owner" on storage.objects for delete to authenticated
using (bucket_id = 'logos' and exists (
  select 1 from public.centres c where c.id::text = (storage.foldername(name))[1] and c.owner_id = auth.uid()));
