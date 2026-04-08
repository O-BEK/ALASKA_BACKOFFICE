# Spec 08 — Modèle de Données (Supabase / PostgreSQL)

---

## 1. Vue d'ensemble

La base de données est hébergée sur **Supabase** (PostgreSQL). Toutes les tables ont le Row Level Security (RLS) activé. Les migrations sont versionnées dans `supabase/migrations/`.

---

## 2. Tables

### 2.1 `users` (géré par Supabase Auth)

Supabase Auth gère les utilisateurs nativement. On stocke les métadonnées de rôle dans `auth.users.raw_user_meta_data`.

```sql
-- Pas de table custom nécessaire, on utilise auth.users
-- Le rôle est dans : auth.users.raw_user_meta_data->>'role'
-- Valeurs : 'admin' | 'manager'
```

### 2.2 `daily_sales` — CA journalier (source caisse)

```sql
CREATE TABLE daily_sales (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE NOT NULL UNIQUE,          -- Un seul enregistrement par jour
  ca_caisse    NUMERIC(10,2) NOT NULL DEFAULT 0,
  ca_b2b       NUMERIC(10,2) NOT NULL DEFAULT 0,
  ca_soir      NUMERIC(10,2) NOT NULL DEFAULT 0,  -- Part soir calculée à l'import
  pct_soir     NUMERIC(5,2),                  -- % du CA réalisé après 19h
  tickets_count INTEGER,                       -- Nb de tickets du jour (import CSV)
  notes        TEXT,                           -- Ramadan, groupe, événement, etc.
  source       TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'csv_import'
  import_id    UUID REFERENCES pos_imports(id) ON DELETE SET NULL,
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_daily_sales_date ON daily_sales(date);
CREATE INDEX idx_daily_sales_month ON daily_sales(DATE_TRUNC('month', date));
```

**Notes :**
- `UNIQUE` sur `date` : un seul enregistrement CA par jour
- Si import CSV sur une date déjà existante → UPSERT (remplacer)
- `ca_soir` et `pct_soir` sont calculés à l'import CSV, null si saisie manuelle

### 2.3 `expenses` — Dépenses quotidiennes

```sql
CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE NOT NULL,
  category     TEXT NOT NULL,     -- 'MP' | 'RH' | 'CHARGES' | 'AUTRE'
  label        TEXT NOT NULL,     -- 'Boucher' | 'Ramzi' | 'Loyer' | etc.
  amount       NUMERIC(10,2) NOT NULL,
  notes        TEXT,
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_month ON expenses(DATE_TRUNC('month', date));
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_label ON expenses(label);
```

**Notes :**
- Plusieurs dépenses par jour (pas de contrainte d'unicité)
- `label` correspond au nom de l'employé ou du fournisseur
- `category = 'RH'` → paiements personnel (avances, salaires)
- `category = 'MP'` → matières premières (Boucher, Poissonnier, etc.)
- `category = 'CHARGES'` → charges fixes payées ce jour (Loyer, etc.)

### 2.4 `fixed_charges` — Charges fixes récurrentes

```sql
CREATE TABLE fixed_charges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,         -- 'Loyer' | 'Ramzi' | 'Électricité'
  category     TEXT NOT NULL,         -- 'IMMOBILIER' | 'PERSONNEL' | 'ENERGIE' | 'TELECOM' | 'DIVERS'
  amount       NUMERIC(10,2) NOT NULL,
  type         TEXT NOT NULL,         -- 'fixed' | 'variable' | 'semi-fixed'
  payment_day  INTEGER,               -- Jour du mois (1, 15, 21, 24...) ou null
  is_staff     BOOLEAN DEFAULT FALSE, -- TRUE si c'est un employé
  start_date   DATE NOT NULL,         -- Date de début d'application
  end_date     DATE,                  -- NULL = actif, sinon date de fin
  is_active    BOOLEAN DEFAULT TRUE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_fixed_charges_active ON fixed_charges(is_active);
CREATE INDEX idx_fixed_charges_date ON fixed_charges(start_date, end_date);
```

**Requête pour les charges actives à une date donnée :**
```sql
SELECT * FROM fixed_charges
WHERE is_active = TRUE
  AND start_date <= :date
  AND (end_date IS NULL OR end_date >= :date);
```

### 2.5 `charge_history` — Historique des modifications de charges

```sql
CREATE TABLE charge_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id       UUID REFERENCES fixed_charges(id),
  old_amount      NUMERIC(10,2),
  new_amount      NUMERIC(10,2),
  changed_by      UUID REFERENCES auth.users(id),
  changed_at      TIMESTAMPTZ DEFAULT NOW(),
  reason          TEXT,              -- Raison du changement (optionnel)
  effective_date  DATE               -- Date d'effet du changement
);
```

### 2.6 `objectives` — Objectifs annuels

```sql
CREATE TABLE objectives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year            INTEGER NOT NULL,
  type            TEXT NOT NULL,        -- 'ca_caisse' | 'ca_b2b' | 'ca_total' | 'marge'
  target_amount   NUMERIC(12,2) NOT NULL,
  scenario        TEXT DEFAULT 'realistic',  -- 'prudent' | 'realistic' | 'ambitious'
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, type, scenario)
);
```

### 2.7 `monthly_objectives` — Décomposition mensuelle des objectifs

```sql
CREATE TABLE monthly_objectives (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year          INTEGER NOT NULL,
  month         INTEGER NOT NULL,   -- 1-12
  target_ca     NUMERIC(10,2),
  target_b2b    NUMERIC(10,2),
  notes         TEXT,               -- 'Ramadan - cible réduite'
  UNIQUE(year, month)
);
```

### 2.8 `action_items` — Plan d'action

```sql
CREATE TABLE action_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lever       TEXT NOT NULL,     -- 'soir' | 'terrasse' | 'b2b' | 'marketing' | 'pilotage'
  title       TEXT NOT NULL,
  description TEXT,
  priority    TEXT NOT NULL,     -- 'urgent' | 'medium' | 'low'
  deadline    TEXT,              -- Texte libre : 'T2 2026', 'Immédiat', etc.
  budget_min  NUMERIC(10,2),
  budget_max  NUMERIC(10,2),
  impact      TEXT,              -- Description impact attendu
  status      TEXT NOT NULL DEFAULT 'todo',  -- 'todo' | 'in_progress' | 'done' | 'cancelled'
  sort_order  INTEGER DEFAULT 0,  -- Pour réordonner manuellement
  completed_at TIMESTAMPTZ,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.9 `pos_imports` — Historique des imports CSV

```sql
CREATE TABLE pos_imports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename         TEXT NOT NULL,
  storage_path     TEXT,              -- Path dans Supabase Storage
  imported_by      UUID REFERENCES auth.users(id),
  imported_at      TIMESTAMPTZ DEFAULT NOW(),
  rows_processed   INTEGER,
  days_imported    INTEGER,
  date_range_start DATE,
  date_range_end   DATE,
  ca_total         NUMERIC(12,2),
  status           TEXT NOT NULL,     -- 'success' | 'error' | 'partial'
  error_message    TEXT
);
```

---

## 3. Row Level Security (RLS)

### Politique globale

```sql
-- Activer RLS sur toutes les tables
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_imports ENABLE ROW LEVEL SECURITY;
```

### Policies admin (accès total)

```sql
CREATE POLICY "admin_full_access" ON daily_sales
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Répéter pour chaque table
```

### Policies manager (accès restreint)

```sql
-- Manager : lecture de daily_sales (pour la vue semaine)
CREATE POLICY "manager_read_daily_sales" ON daily_sales
  FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'manager');

-- Manager : lecture et écriture de ses propres dépenses
CREATE POLICY "manager_own_expenses" ON expenses
  FOR ALL USING (
    created_by = auth.uid()
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
  );

-- Manager : pas d'accès aux charges, objectifs, imports
-- (pas de policy = accès refusé par défaut avec RLS activé)
```

---

## 4. Fonctions SQL utiles

### Total charges fixes actives à une date

```sql
CREATE OR REPLACE FUNCTION get_total_fixed_charges(target_date DATE)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM fixed_charges
  WHERE is_active = TRUE
    AND start_date <= target_date
    AND (end_date IS NULL OR end_date >= target_date);
$$ LANGUAGE SQL STABLE;
```

### Calcul seuil de rentabilité

```sql
CREATE OR REPLACE FUNCTION get_breakeven(target_date DATE, variable_cost_rate NUMERIC DEFAULT 0.28)
RETURNS NUMERIC AS $$
  SELECT get_total_fixed_charges(target_date) / (1 - variable_cost_rate);
$$ LANGUAGE SQL STABLE;
```

### CA mensuel agrégé

```sql
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
```

---

## 5. Seed Data (données initiales)

Fichier `supabase/seed.sql` à exécuter à l'initialisation :

### Données daily_sales 2025

```sql
-- CA mensuel 2025 (agrégé, pas de données journalières détaillées pour 2025)
INSERT INTO daily_sales (date, ca_caisse, source, notes) VALUES
-- Jan 2025 : 31 enregistrements avec ca_caisse quotidien depuis le CSV historique
-- (données extraites du fichier ventes_tout.csv)
...
```

### Données daily_sales 2026 (Q1)

91 enregistrements journaliers Jan-Avr 2026, extraits du fichier `ventes_07042026_120153.csv`.

### Données expenses 2026

91 enregistrements de dépenses extraits du fichier `Alaska_Suivi_Semaines_2026.xlsx`.

### Données fixed_charges

```sql
INSERT INTO fixed_charges (name, category, amount, type, start_date, is_staff, payment_day) VALUES
('Loyer',        'IMMOBILIER', 34000, 'fixed',       '2024-10-01', FALSE, 1),
('Électricité',  'ENERGIE',     6000, 'variable',    '2024-10-01', FALSE, NULL),
('Gaz',          'ENERGIE',     1800, 'variable',    '2024-10-01', FALSE, NULL),
('Internet',     'TELECOM',      500, 'fixed',       '2024-10-01', FALSE, 1),
('Transport',    'DIVERS',      6200, 'variable',    '2024-10-01', FALSE, NULL),
('Divers',       'DIVERS',     10000, 'variable',    '2024-10-01', FALSE, NULL),
-- Personnel (montants à compléter par Othman)
('Ramzi',   'PERSONNEL', 0, 'semi-fixed', '2024-10-01', TRUE, 1),
('Leila',   'PERSONNEL', 0, 'semi-fixed', '2024-10-01', TRUE, 21),
('Noeman',  'PERSONNEL', 0, 'semi-fixed', '2024-10-01', TRUE, 1),
('Mike',    'PERSONNEL', 0, 'semi-fixed', '2024-10-01', TRUE, 1),
('Paul',    'PERSONNEL', 0, 'semi-fixed', '2024-10-01', TRUE, 17),
('Adil',    'PERSONNEL', 0, 'semi-fixed', '2024-10-01', TRUE, 21),
('Glody',   'PERSONNEL', 0, 'semi-fixed', '2024-10-01', TRUE, 21),
('Aicha',   'PERSONNEL', 0, 'semi-fixed', '2024-10-01', TRUE, 21),
('Chaimae', 'PERSONNEL', 0, 'semi-fixed', '2024-10-01', TRUE, 24);
```

### Données objectives

```sql
INSERT INTO objectives (year, type, target_amount, scenario, notes) VALUES
(2025, 'ca_total', 1400000, 'realistic', 'Cible personnelle Othman Y1'),
(2026, 'ca_total', 2277882, 'realistic', 'Y2 = Y1 réel +30%'),
(2026, 'ca_total', 1927439, 'prudent',   'Y2 = Y1 réel +10%'),
(2026, 'ca_total', 2628326, 'ambitious', 'Y2 = Y1 réel +50%'),
(2027, 'ca_total', 2847352, 'realistic', 'Y3 = Y2 réaliste +25%');
```

---

## 6. TypeScript Types (`lib/types.ts`)

```typescript
export type UserRole = 'admin' | 'manager';

export interface DailySale {
  id: string;
  date: string;          // YYYY-MM-DD
  ca_caisse: number;
  ca_b2b: number;
  ca_soir: number;
  pct_soir: number | null;
  tickets_count: number | null;
  notes: string | null;
  source: 'manual' | 'csv_import';
  import_id: string | null;
}

export interface Expense {
  id: string;
  date: string;
  category: 'MP' | 'RH' | 'CHARGES' | 'AUTRE';
  label: string;
  amount: number;
  notes: string | null;
  created_by: string;
}

export interface FixedCharge {
  id: string;
  name: string;
  category: 'IMMOBILIER' | 'PERSONNEL' | 'ENERGIE' | 'TELECOM' | 'DIVERS';
  amount: number;
  type: 'fixed' | 'variable' | 'semi-fixed';
  payment_day: number | null;
  is_staff: boolean;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
}

export interface ActionItem {
  id: string;
  lever: 'soir' | 'terrasse' | 'b2b' | 'marketing' | 'pilotage';
  title: string;
  description: string | null;
  priority: 'urgent' | 'medium' | 'low';
  deadline: string | null;
  budget_min: number | null;
  budget_max: number | null;
  impact: string | null;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
}

export interface MonthlyKPIs {
  month: string;        // YYYY-MM
  ca_caisse: number;
  ca_b2b: number;
  ca_total: number;
  ca_soir: number;
  pct_soir: number;
  total_expenses: number;
  marge_nette: number;
  taux_marge: number;
  breakeven: number;
  pct_breakeven: number;
  days_count: number;
  ca_per_day: number;
}
```
