-- Bucket prive pour archiver les fichiers source des imports POS.
-- Les routes serveur uploadent via service_role apres verification admin.

INSERT INTO storage.buckets (id, name, public)
VALUES ('pos-imports', 'pos-imports', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "admin_pos_imports_storage_objects" ON storage.objects;
CREATE POLICY "admin_pos_imports_storage_objects" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'pos-imports'
    AND public.auth_user_role() = 'admin'
  )
  WITH CHECK (
    bucket_id = 'pos-imports'
    AND public.auth_user_role() = 'admin'
  );
