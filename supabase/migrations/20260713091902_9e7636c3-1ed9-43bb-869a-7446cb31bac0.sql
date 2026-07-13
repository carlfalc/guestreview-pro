
drop policy if exists "Marketing pack previews: owner select" on storage.objects;
create policy "Marketing pack previews: owner select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'marketing-pack-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Marketing pack previews: owner insert" on storage.objects;
create policy "Marketing pack previews: owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'marketing-pack-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Marketing pack previews: owner update" on storage.objects;
create policy "Marketing pack previews: owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'marketing-pack-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'marketing-pack-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Marketing pack previews: owner delete" on storage.objects;
create policy "Marketing pack previews: owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'marketing-pack-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
