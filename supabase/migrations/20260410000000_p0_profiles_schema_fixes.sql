-- Migration P0: profiles, mouvement_caisse, RLS complet
-- Date: 2026-04-10

-- =========================================
-- 1. Ajouter mouvement_caisse à daily_sales
-- =========================================
ALTER TABLE public.daily_sales
  ADD COLUMN IF NOT EXISTS mouvement_caisse NUMERIC(10,2) NOT NULL DEFAULT 0;

-- =========================================
-- 2. Table profiles (rôle stocké côté serveur)
-- =========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('admin', 'manager')),
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- =========================================
-- 3. Trigger auto-création profil à l'inscription
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'manager'),
    NEW.raw_user_meta_data->>'name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill des utilisateurs existants
INSERT INTO public.profiles (id, role, name)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'role', 'manager'),
  raw_user_meta_data->>'name'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- =========================================
-- 4. Fonction SECURITY DEFINER pour lire le rôle
-- =========================================
CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

-- =========================================
-- 5. RLS sur tables oubliées
-- =========================================
ALTER TABLE public.monthly_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charge_history ENABLE ROW LEVEL SECURITY;

-- =========================================
-- 6. Réécriture des policies avec auth_user_role()
-- =========================================

-- daily_sales
DROP POLICY IF EXISTS "admin_full_access" ON public.daily_sales;
DROP POLICY IF EXISTS "manager_read_daily_sales" ON public.daily_sales;

CREATE POLICY "admin_full_access_daily_sales" ON public.daily_sales
  FOR ALL USING (public.auth_user_role() = 'admin');

CREATE POLICY "manager_read_daily_sales" ON public.daily_sales
  FOR SELECT USING (public.auth_user_role() = 'manager');

CREATE POLICY "manager_insert_daily_sales" ON public.daily_sales
  FOR INSERT WITH CHECK (public.auth_user_role() = 'manager');

CREATE POLICY "manager_update_daily_sales" ON public.daily_sales
  FOR UPDATE USING (public.auth_user_role() = 'manager');

-- expenses
DROP POLICY IF EXISTS "admin_expenses" ON public.expenses;
DROP POLICY IF EXISTS "manager_own_expenses" ON public.expenses;

CREATE POLICY "admin_expenses" ON public.expenses
  FOR ALL USING (public.auth_user_role() = 'admin');

CREATE POLICY "manager_own_expenses" ON public.expenses
  FOR ALL USING (
    created_by = auth.uid()
    AND public.auth_user_role() = 'manager'
  );

-- fixed_charges
DROP POLICY IF EXISTS "admin_fixed_charges" ON public.fixed_charges;
CREATE POLICY "admin_fixed_charges" ON public.fixed_charges
  FOR ALL USING (public.auth_user_role() = 'admin');

-- objectives
DROP POLICY IF EXISTS "admin_objectives" ON public.objectives;
CREATE POLICY "admin_objectives" ON public.objectives
  FOR ALL USING (public.auth_user_role() = 'admin');

-- monthly_objectives
CREATE POLICY "admin_monthly_objectives" ON public.monthly_objectives
  FOR ALL USING (public.auth_user_role() = 'admin');

-- action_items
DROP POLICY IF EXISTS "admin_action_items" ON public.action_items;
CREATE POLICY "admin_action_items" ON public.action_items
  FOR ALL USING (public.auth_user_role() = 'admin');

-- pos_imports
DROP POLICY IF EXISTS "admin_pos_imports" ON public.pos_imports;
CREATE POLICY "admin_pos_imports" ON public.pos_imports
  FOR ALL USING (public.auth_user_role() = 'admin');

-- charge_history
CREATE POLICY "admin_charge_history" ON public.charge_history
  FOR ALL USING (public.auth_user_role() = 'admin');
