export type UserRole = "admin" | "manager"
export type ImportType = "sales_csv" | "cash_journal_xls"

export interface DailyEntry {
  date: string // YYYY-MM-DD
  ca_caisse: number
  ca_b2b: number
  ca_soir: number
  pct_soir: number
  tickets_count: number
  mouvement_caisse: number
  cash_sales_journal: number | null
  cash_movements_journal: number | null
  cash_opening_fund: number | null
  cash_closing_fund: number | null
  cash_journal_sessions: number
  cash_journal_anomaly: boolean
  cash_journal_import_id: string | null
  notes: string
  source: "manual" | "csv_import"
  expenses: ExpenseItem[]
}

export interface ExpenseItem {
  id: string
  category: "MP" | "RH" | "CHARGES" | "AUTRE"
  label: string
  amount: number
  notes?: string
}

export interface FixedCharge {
  id: string
  name: string
  category: "IMMOBILIER" | "PERSONNEL" | "ENERGIE" | "TELECOM" | "DIVERS" | string
  amount: number
  type: "fixed" | "variable" | "semi-fixed"
  payment_day: number | null
  is_staff: boolean
  is_active: boolean
  start_date: string
  end_date: string | null
}

export interface ExpenseItemTemplate {
  id: string
  section_id: string
  label: string
  is_active: boolean
  sort_order: number
}

export interface ExpenseSection {
  id: string
  name: string
  emoji: string
  expense_category: "MP" | "CHARGES" | "AUTRE"
  sort_order: number
  is_active: boolean
  items: ExpenseItemTemplate[]
}

export interface ActionItem {
  id: string
  lever: "soir" | "terrasse" | "b2b" | "marketing" | "pilotage"
  title: string
  description: string
  priority: "urgent" | "medium" | "low"
  deadline: string
  budget_min: number
  budget_max: number
  impact: string
  status: "todo" | "in_progress" | "done" | "cancelled"
}

export interface Objective {
  id: string
  year: number
  type: "ca_caisse" | "ca_b2b" | "ca_total"
  target_amount: number
  scenario: "prudent" | "realistic" | "ambitious"
}

export interface MonthlyObjective {
  year: number
  month: number
  target_ca: number
  notes?: string
}

export interface MonthlyKPIs {
  month: string // YYYY-MM
  ca_caisse: number
  ca_b2b: number
  ca_total: number
  ca_soir: number
  pct_soir: number
  total_expenses: number
  marge_nette: number
  taux_marge: number
  breakeven: number
  pct_breakeven: number
  days_count: number
  ca_per_day: number
}

export interface ImportRecord {
  id: string
  filename: string
  import_type: ImportType
  imported_at: string
  rows_processed: number
  days_imported: number
  date_range_start: string
  date_range_end: string
  ca_total: number
  status: "success" | "error" | "partial"
}
