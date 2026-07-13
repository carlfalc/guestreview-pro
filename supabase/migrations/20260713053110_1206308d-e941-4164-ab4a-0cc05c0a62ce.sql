-- RLS policies for pack-previews bucket. Path convention: {owner_id}/{pack_id}.png
CREATE POLICY "Pack previews: owner select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pack-previews' AND owner = auth.uid());

CREATE POLICY "Pack previews: owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pack-previews' AND owner = auth.uid() AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Pack previews: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pack-previews' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'pack-previews' AND owner = auth.uid());

CREATE POLICY "Pack previews: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pack-previews' AND owner = auth.uid());
