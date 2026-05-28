CREATE TABLE ai_monthly_summaries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month            text NOT NULL UNIQUE,  -- format YYYY-MM
  generated_at     timestamptz NOT NULL,
  summary_md       text NOT NULL,
  model_used       text NOT NULL,
  context_snapshot jsonb
);

ALTER TABLE ai_monthly_summaries ENABLE ROW LEVEL SECURITY;

-- Lecture : admin uniquement
CREATE POLICY "ai_summaries_select" ON ai_monthly_summaries
  FOR SELECT TO authenticated USING (public.auth_user_role() = 'admin');

-- Écriture : admin uniquement
CREATE POLICY "ai_summaries_insert" ON ai_monthly_summaries
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_role() = 'admin');

CREATE POLICY "ai_summaries_delete" ON ai_monthly_summaries
  FOR DELETE TO authenticated
  USING (public.auth_user_role() = 'admin');
