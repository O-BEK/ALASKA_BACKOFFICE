ALTER TABLE public.pos_imports
  ADD COLUMN IF NOT EXISTS import_type TEXT NOT NULL DEFAULT 'sales_csv';

UPDATE public.pos_imports
SET import_type = 'sales_csv'
WHERE import_type IS NULL;

DO $$
BEGIN
  ALTER TABLE public.pos_imports
    ADD CONSTRAINT pos_imports_import_type_check
    CHECK (import_type IN ('sales_csv', 'cash_journal_xls'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.daily_sales
  ADD COLUMN IF NOT EXISTS cash_sales_journal NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cash_movements_journal NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cash_opening_fund NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cash_closing_fund NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cash_journal_sessions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_journal_anomaly BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cash_journal_import_id UUID REFERENCES public.pos_imports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_sales_cash_journal_import_id
  ON public.daily_sales (cash_journal_import_id);
