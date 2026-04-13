-- Durcissement: ne plus dériver le rôle depuis user_metadata à l'inscription
-- Les rôles admin/manager sont désormais attribués explicitement via service_role.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, name)
  VALUES (
    NEW.id,
    'manager',
    NULLIF(NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO UPDATE
    SET name = COALESCE(public.profiles.name, EXCLUDED.name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

UPDATE public.profiles AS profiles
SET name = COALESCE(profiles.name, NULLIF(users.raw_user_meta_data->>'name', ''))
FROM auth.users AS users
WHERE users.id = profiles.id
  AND (profiles.name IS NULL OR profiles.name = '');
