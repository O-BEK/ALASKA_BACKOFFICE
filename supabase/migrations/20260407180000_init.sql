-- Migration: Phase 1 MVP Alaska Pilot
-- Contient: daily_sales, expenses, fixed_charges, pos_imports, user setup (via auth)
-- Date: 2026-04-07

CREATE TABLE pos_imports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename         TEXT NOT NULL,
  storage_path     TEXT,
  imported_by      UUID REFERENCES auth.users(id),
  imported_at      TIMESTAMPTZ DEFAULT NOW(),
  rows_processed   INTEGER,
  days_imported    INTEGER,
  date_range_start DATE,
  date_range_end   DATE,
  ca_total         NUMERIC(12,2),
  status           TEXT NOT NULL,
  error_message    TEXT
);

CREATE TABLE daily_sales (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE NOT NULL UNIQUE,
  ca_caisse    NUMERIC(10,2) NOT NULL DEFAULT 0,
  ca_b2b       NUMERIC(10,2) NOT NULL DEFAULT 0,
  ca_soir      NUMERIC(10,2) NOT NULL DEFAULT 0,
  pct_soir     NUMERIC(5,2),
  tickets_count INTEGER,
  notes        TEXT,
  source       TEXT NOT NULL DEFAULT 'manual',
  import_id    UUID REFERENCES pos_imports(id) ON DELETE SET NULL,
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_daily_sales_date ON daily_sales(date);
CREATE INDEX idx_daily_sales_month ON daily_sales(DATE_TRUNC('month', date));

CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE NOT NULL,
  category     TEXT NOT NULL,
  label        TEXT NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  notes        TEXT,
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_month ON expenses(DATE_TRUNC('month', date));
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_label ON expenses(label);

CREATE TABLE fixed_charges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  type         TEXT NOT NULL,
  payment_day  INTEGER,
  is_staff     BOOLEAN DEFAULT FALSE,
  start_date   DATE NOT NULL,
  end_date     DATE,
  is_active    BOOLEAN DEFAULT TRUE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fixed_charges_active ON fixed_charges(is_active);
CREATE INDEX idx_fixed_charges_date ON fixed_charges(start_date, end_date);

CREATE TABLE charge_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id       UUID REFERENCES fixed_charges(id),
  old_amount      NUMERIC(10,2),
  new_amount      NUMERIC(10,2),
  changed_by      UUID REFERENCES auth.users(id),
  changed_at      TIMESTAMPTZ DEFAULT NOW(),
  reason          TEXT,
  effective_date  DATE
);

CREATE TABLE objectives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year            INTEGER NOT NULL,
  type            TEXT NOT NULL,
  target_amount   NUMERIC(12,2) NOT NULL,
  scenario        TEXT DEFAULT 'realistic',
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, type, scenario)
);

CREATE TABLE monthly_objectives (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year          INTEGER NOT NULL,
  month         INTEGER NOT NULL,
  target_ca     NUMERIC(10,2),
  target_b2b    NUMERIC(10,2),
  notes         TEXT,
  UNIQUE(year, month)
);

CREATE TABLE action_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lever       TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  priority    TEXT NOT NULL,
  deadline    TEXT,
  budget_min  NUMERIC(10,2),
  budget_max  NUMERIC(10,2),
  impact      TEXT,
  status      TEXT NOT NULL DEFAULT 'todo',
  sort_order  INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON daily_sales
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "manager_read_daily_sales" ON daily_sales
  FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'manager');

CREATE POLICY "admin_expenses" ON expenses
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "manager_own_expenses" ON expenses
  FOR ALL USING (
    created_by = auth.uid()
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
  );

CREATE POLICY "admin_fixed_charges" ON fixed_charges
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_objectives" ON objectives
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_action_items" ON action_items
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_pos_imports" ON pos_imports
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Useful Functions

CREATE OR REPLACE FUNCTION get_total_fixed_charges(target_date DATE)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM fixed_charges
  WHERE is_active = TRUE
    AND start_date <= target_date
    AND (end_date IS NULL OR end_date >= target_date);
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION get_breakeven(target_date DATE, variable_cost_rate NUMERIC DEFAULT 0.28)
RETURNS NUMERIC AS $$
  SELECT get_total_fixed_charges(target_date) / (1 - variable_cost_rate);
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION get_monthly_ca(target_year INTEGER, target_month INTEGER)
RETURNS TABLE(ca_caisse NUMERIC, ca_b2b NUMERIC, ca_soir NUMERIC, days_count INTEGER) AS $$
  SELECT
    COALESCE(SUM(ca_caisse), 0),
    COALESCE(SUM(ca_b2b), 0),
    COALESCE(SUM(ca_soir), 0),
    COUNT(*)::INTEGER
  FROM daily_sales
  WHERE EXTRACT(YEAR FROM date) = target_year
    AND EXTRACT(MONTH FROM date) = target_month;
$$ LANGUAGE SQL STABLE;
