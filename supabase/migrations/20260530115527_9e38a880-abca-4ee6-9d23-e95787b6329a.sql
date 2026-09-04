
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photo-analysis', 'photo-analysis', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

create policy "Public can read photo-analysis"
on storage.objects for select
using (bucket_id = 'photo-analysis');

create policy "Anyone can upload to photo-analysis"
on storage.objects for insert
with check (bucket_id = 'photo-analysis');

create policy "Anyone can delete photo-analysis"
on storage.objects for delete
using (bucket_id = 'photo-analysis');
