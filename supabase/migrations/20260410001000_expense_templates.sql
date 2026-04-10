-- expense_sections : sections affichées dans la page saisie (hors Personnel)
CREATE TABLE public.expense_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  emoji       text NOT NULL DEFAULT '📦',
  expense_category text NOT NULL DEFAULT 'AUTRE'
    CHECK (expense_category IN ('MP', 'CHARGES', 'AUTRE')),
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- expense_item_templates : items prédéfinis par section
CREATE TABLE public.expense_item_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  uuid NOT NULL REFERENCES public.expense_sections(id) ON DELETE CASCADE,
  label       text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE public.expense_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_item_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_sections_read" ON public.expense_sections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "expense_sections_write" ON public.expense_sections
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'admin')
  WITH CHECK (public.auth_user_role() = 'admin');

CREATE POLICY "expense_item_templates_read" ON public.expense_item_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "expense_item_templates_write" ON public.expense_item_templates
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'admin')
  WITH CHECK (public.auth_user_role() = 'admin');

-- Seed sections
INSERT INTO public.expense_sections (name, emoji, expense_category, sort_order) VALUES
  ('Matières Premières', '🥩', 'MP',      1),
  ('Autres Charges',     '📦', 'CHARGES', 2);

-- Items MP
WITH sec AS (SELECT id FROM public.expense_sections WHERE expense_category = 'MP' LIMIT 1)
INSERT INTO public.expense_item_templates (section_id, label, sort_order)
SELECT sec.id, label, sort_order FROM sec, (VALUES
  ('Poissonnier',          1),
  ('Boucher',              2),
  ('Poulet',               3),
  ('Eau',                  4),
  ('Technicien & courses', 5)
) AS t(label, sort_order);

-- Items Autres Charges
WITH sec AS (SELECT id FROM public.expense_sections WHERE expense_category = 'CHARGES' LIMIT 1)
INSERT INTO public.expense_item_templates (section_id, label, sort_order)
SELECT sec.id, label, sort_order FROM sec, (VALUES
  ('Loyer',        1),
  ('Électricité',  2),
  ('Gaz',          3),
  ('Internet',     4),
  ('Autre',        5)
) AS t(label, sort_order);
