import { z } from "zod"
import type {
  ActionItem,
  DailyEntry,
  ExpenseItem,
  ExpenseSection,
  FixedCharge,
  ImportType,
  ImportRecord,
  MonthlyKPIs,
  MonthlyObjective,
  Objective,
} from "@/lib/types"

const expenseItemSchema = z.object({
  id: z.string().catch(""),
  category: z.enum(["MP", "RH", "CHARGES", "AUTRE"]).catch("AUTRE"),
  label: z.string().catch(""),
  amount: z.coerce.number().catch(0),
  notes: z.string().optional(),
})

const dailyEntrySchema = z.object({
  date: z.string().catch(""),
  ca_caisse: z.coerce.number().catch(0),
  ca_b2b: z.coerce.number().catch(0),
  ca_soir: z.coerce.number().catch(0),
  pct_soir: z.coerce.number().catch(0),
  tickets_count: z.coerce.number().catch(0),
  mouvement_caisse: z.coerce.number().catch(0),
  cash_sales_journal: z.coerce.number().nullable().catch(null),
  cash_movements_journal: z.coerce.number().nullable().catch(null),
  cash_opening_fund: z.coerce.number().nullable().catch(null),
  cash_closing_fund: z.coerce.number().nullable().catch(null),
  cash_journal_sessions: z.coerce.number().catch(0),
  cash_journal_anomaly: z.coerce.boolean().catch(false),
  cash_journal_import_id: z.string().nullable().catch(null),
  notes: z.string().catch(""),
  source: z.enum(["manual", "csv_import"]).catch("manual"),
  expenses: z.array(expenseItemSchema).catch([]),
})

const monthlyKpisSchema = z.object({
  month: z.string().catch(""),
  ca_caisse: z.coerce.number().catch(0),
  ca_b2b: z.coerce.number().catch(0),
  ca_total: z.coerce.number().catch(0),
  ca_soir: z.coerce.number().catch(0),
  pct_soir: z.coerce.number().catch(0),
  total_expenses: z.coerce.number().catch(0),
  marge_nette: z.coerce.number().catch(0),
  taux_marge: z.coerce.number().catch(0),
  breakeven: z.coerce.number().catch(0),
  pct_breakeven: z.coerce.number().catch(0),
  days_count: z.coerce.number().catch(0),
  ca_per_day: z.coerce.number().catch(0),
})

const dashboardLast12Schema = z.object({
  month: z.string().catch(""),
  ca_caisse: z.coerce.number().catch(0),
  ca_b2b: z.coerce.number().catch(0),
  ca_total: z.coerce.number().catch(0),
  breakeven: z.coerce.number().catch(0),
})

const dashboardObjectiveSchema = z.object({
  target: z.coerce.number().nullable().catch(null),
  real: z.coerce.number().catch(0),
  pct: z.coerce.number().catch(0),
  remaining: z.coerce.number().catch(0),
  daily_target: z.coerce.number().catch(0),
  note: z.string().catch(""),
})

const dashboardTodaySchema = z.object({
  date: z.string().catch(""),
  ca_caisse: z.coerce.number().catch(0),
  ca_b2b: z.coerce.number().catch(0),
  ca_total: z.coerce.number().catch(0),
  total_expenses: z.coerce.number().catch(0),
  notes: z.array(z.string()).catch([]),
  status: z.enum(["missing", "partial", "complete"]).catch("missing"),
})

const dashboardWeeklySchema = z.object({
  label: z.string().catch(""),
  range: z.string().catch(""),
  ca_total: z.coerce.number().catch(0),
  days_count: z.coerce.number().catch(0),
  ca_per_day: z.coerce.number().catch(0),
  breakeven: z.coerce.number().catch(0),
})

const cashMonthSchema = z.object({
  month: z.string().catch(""),
  cash_sales: z.coerce.number().catch(0),
  cash_movements: z.coerce.number().catch(0),
  cash_mp_divers: z.coerce.number().catch(0),
  mp_divers_items: z.array(z.object({ label: z.string().catch(""), amount: z.coerce.number().catch(0) })).catch([]),
  cash_charges: z.coerce.number().catch(0),
  cash_rh: z.coerce.number().catch(0),
  cash_depot: z.coerce.number().catch(0),
  cash_purchases: z.coerce.number().catch(0),
  cash_envelope: z.coerce.number().catch(0),
  ca_global: z.coerce.number().catch(0),
  anomaly_days: z.coerce.number().catch(0),
  days_count: z.coerce.number().catch(0),
  prime_cost_pct: z.coerce.number().catch(0),
  resultat_net: z.coerce.number().catch(0),
})

const dashboardKpisSecondarySchema = z.object({
  avg_ticket: z.coerce.number().catch(0),
  coverage_pct: z.coerce.number().catch(0),
  mix_cash_pct: z.coerce.number().catch(0),
})

const dashboardStateSchema = z.object({
  kpis: monthlyKpisSchema.catch({
    month: "",
    ca_caisse: 0,
    ca_b2b: 0,
    ca_total: 0,
    ca_soir: 0,
    pct_soir: 0,
    total_expenses: 0,
    marge_nette: 0,
    taux_marge: 0,
    breakeven: 0,
    pct_breakeven: 0,
    days_count: 0,
    ca_per_day: 0,
  }),
  delta_ca: z.coerce.number().catch(0),
  delta_expenses: z.coerce.number().catch(0),
  delta_marge: z.coerce.number().catch(0),
  last12: z.array(dashboardLast12Schema).catch([]),
  hasMonthData: z.coerce.boolean().catch(false),
  monthObjective: dashboardObjectiveSchema.catch({
    target: null,
    real: 0,
    pct: 0,
    remaining: 0,
    daily_target: 0,
    note: "",
  }),
  today: dashboardTodaySchema.catch({
    date: "",
    ca_caisse: 0,
    ca_b2b: 0,
    ca_total: 0,
    total_expenses: 0,
    notes: [],
    status: "missing",
  }),
  cashMonth: cashMonthSchema.catch({
    month: "",
    cash_sales: 0,
    cash_movements: 0,
    cash_mp_divers: 0,
    mp_divers_items: [],
    cash_charges: 0,
    cash_rh: 0,
    cash_depot: 0,
    cash_purchases: 0,
    cash_envelope: 0,
    ca_global: 0,
    anomaly_days: 0,
    days_count: 0,
    prime_cost_pct: 0,
    resultat_net: 0,
  }),
  weeklyMonth: z.array(dashboardWeeklySchema).catch([]),
  kpis_secondary: dashboardKpisSecondarySchema.catch({
    avg_ticket: 0,
    coverage_pct: 0,
    mix_cash_pct: 0,
  }),
})

const actionItemSchema = z.object({
  id: z.string().catch(""),
  lever: z.enum(["soir", "terrasse", "b2b", "marketing", "pilotage"]).catch("pilotage"),
  title: z.string().catch(""),
  description: z.string().catch(""),
  priority: z.enum(["urgent", "medium", "low"]).catch("medium"),
  deadline: z.string().catch(""),
  budget_min: z.coerce.number().catch(0),
  budget_max: z.coerce.number().catch(0),
  impact: z.string().catch(""),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).catch("todo"),
})

const objectiveSchema = z.object({
  id: z.string().catch(""),
  year: z.coerce.number().catch(0),
  type: z.enum(["ca_caisse", "ca_b2b", "ca_total"]).catch("ca_total"),
  target_amount: z.coerce.number().catch(0),
  scenario: z.enum(["prudent", "realistic", "ambitious"]).catch("realistic"),
})

const monthlyObjectiveSchema = z.object({
  year: z.coerce.number().catch(0),
  month: z.coerce.number().catch(0),
  target_ca: z.coerce.number().catch(0),
  notes: z.string().optional(),
})

const monthlyRealSchema = z.object({
  year: z.coerce.number().catch(0),
  month: z.coerce.number().catch(0),
  real: z.coerce.number().catch(0),
  target: z.coerce.number().catch(0),
  notes: z.string().catch(""),
})

const objectivesPayloadSchema = z.object({
  actions: z.array(actionItemSchema).catch([]),
  objectives: z.array(objectiveSchema).catch([]),
  monthlyObjectives: z.array(monthlyObjectiveSchema).catch([]),
  monthlyReal: z.array(monthlyRealSchema).catch([]),
})

const importRecordSchema = z.object({
  id: z.string().catch(""),
  filename: z.string().catch(""),
  storage_path: z.string().nullable().catch(null),
  import_type: z.enum(["sales_csv", "cash_journal_xls"]).catch("sales_csv"),
  imported_at: z.string().catch(""),
  rows_processed: z.coerce.number().catch(0),
  days_imported: z.coerce.number().catch(0),
  date_range_start: z.string().catch(""),
  date_range_end: z.string().catch(""),
  ca_total: z.coerce.number().catch(0),
  status: z.enum(["success", "error", "partial"]).catch("success"),
})

const monthlySummarySchema = z.object({
  month: z.string().catch(""),
  days_csv: z.coerce.number().catch(0),
  days_manual: z.coerce.number().catch(0),
  ca_total: z.coerce.number().catch(0),
})

const importHistoryPayloadSchema = z.object({
  history: z.array(importRecordSchema).catch([]),
  monthly_summary: z.array(monthlySummarySchema).catch([]),
})

const weekDaySchema = z.object({
  date: z.string().catch(""),
  label: z.string().catch(""),
  entry: dailyEntrySchema.nullable().catch(null),
  totalExpenses: z.coerce.number().catch(0),
  status: z.enum(["empty", "partial", "full"]).catch("empty"),
})

const expenseByLabelSchema = z.object({
  label: z.string().catch(""),
  amount: z.coerce.number().catch(0),
})

const weekSummarySchema = z.object({
  days: z.array(weekDaySchema).catch([]),
  totalCA: z.coerce.number().catch(0),
  totalDep: z.coerce.number().catch(0),
  marge: z.coerce.number().catch(0),
  totalCashSales: z.coerce.number().catch(0),
  totalCashMovements: z.coerce.number().catch(0),
  totalCashEnvelope: z.coerce.number().catch(0),
  cashAnomalyDays: z.coerce.number().catch(0),
  weeklyBreakeven: z.coerce.number().catch(0),
  pctBreakeven: z.coerce.number().catch(0),
  expensesByLabel: z.array(expenseByLabelSchema).catch([]),
})

const weekEntriesSchema = z.record(z.string(), dailyEntrySchema).catch({})

const weekPayloadSchema = z.object({
  summary: weekSummarySchema.catch({
    days: [],
    totalCA: 0,
    totalDep: 0,
    marge: 0,
    totalCashSales: 0,
    totalCashMovements: 0,
    totalCashEnvelope: 0,
    cashAnomalyDays: 0,
    weeklyBreakeven: 0,
    pctBreakeven: 0,
    expensesByLabel: [],
  }),
  entries: weekEntriesSchema,
})

export const bankConsolidationSchema = z.object({
  has_data: z.boolean().catch(false),
  banks: z.array(z.object({
    bank: z.string().catch(""),
    label: z.string().catch(""),
    total_debit: z.coerce.number().catch(0),
    total_credit: z.coerce.number().catch(0),
    transaction_count: z.coerce.number().catch(0),
  })).catch([]),
  total_debit: z.coerce.number().catch(0),
  total_credit: z.coerce.number().catch(0),
  import_count: z.coerce.number().catch(0),
})

export type BankConsolidation = z.infer<typeof bankConsolidationSchema>

export const financialConsolidationSchema = z.object({
  has_data: z.boolean().catch(false),
  ca_pos: z.coerce.number().catch(0),
  cash_expenses: z.coerce.number().catch(0),
  cash_deposits: z.coerce.number().catch(0),
  bank_expenses: z.coerce.number().catch(0),
  external_income: z.coerce.number().catch(0),
  owner_injections: z.coerce.number().catch(0),
  bank_cash_deposits: z.coerce.number().catch(0),
  bank_debits: z.coerce.number().catch(0),
  bank_credits: z.coerce.number().catch(0),
  bank_net: z.coerce.number().catch(0),
  real_result: z.coerce.number().catch(0),
  owner_support_needed: z.coerce.number().catch(0),
  pending_review_count: z.coerce.number().catch(0),
  confirmed_count: z.coerce.number().catch(0),
  status: z.enum(["profit", "loss"]).catch("loss"),
  alert: z.string().catch(""),
  by_classification: z.array(z.object({
    classification: z.string().catch(""),
    debit: z.coerce.number().catch(0),
    credit: z.coerce.number().catch(0),
    count: z.coerce.number().catch(0),
  })).catch([]),
})

export type FinancialConsolidation = z.infer<typeof financialConsolidationSchema>

const weekComparisonItemSchema = z.object({
  label: z.string().catch(""),
  current: z.coerce.number().catch(0),
  previous: z.coerce.number().catch(0),
})

const reportingPayloadSchema = z.object({
  summary: z.object({
    ca_caisse: z.coerce.number().catch(0),
    ca_b2b: z.coerce.number().catch(0),
    ca_total: z.coerce.number().catch(0),
    prev_total: z.coerce.number().catch(0),
    prev_year_total: z.coerce.number().catch(0),
    prev_pct: z.coerce.number().catch(0),
    prev_year_pct: z.coerce.number().catch(0),
    ca_per_day: z.coerce.number().catch(0),
    days_count: z.coerce.number().catch(0),
    total_expenses: z.coerce.number().catch(0),
    marge_nette: z.coerce.number().catch(0),
    taux_marge: z.coerce.number().catch(0),
    breakeven: z.coerce.number().catch(0),
    pct_seuil: z.coerce.number().catch(0),
    solde_mois: z.coerce.number().catch(0),
    ca_soir: z.coerce.number().catch(0),
    pct_soir: z.coerce.number().catch(0),
    tickets_count: z.coerce.number().catch(0),
    avg_ticket: z.coerce.number().catch(0),
  }).catch({
    ca_caisse: 0,
    ca_b2b: 0,
    ca_total: 0,
    prev_total: 0,
    prev_year_total: 0,
    prev_pct: 0,
    prev_year_pct: 0,
    ca_per_day: 0,
    days_count: 0,
    total_expenses: 0,
    marge_nette: 0,
    taux_marge: 0,
    breakeven: 0,
    pct_seuil: 0,
    solde_mois: 0,
    ca_soir: 0,
    pct_soir: 0,
    tickets_count: 0,
    avg_ticket: 0,
  }),
  projection: z.object({
    month_days: z.coerce.number().catch(0),
    days_count: z.coerce.number().catch(0),
    projected_ca: z.coerce.number().catch(0),
    reference_type: z.enum(["objective", "breakeven"]).catch("breakeven"),
    reference_value: z.coerce.number().catch(0),
    projected_gap: z.coerce.number().catch(0),
    required_daily: z.coerce.number().catch(0),
  }).catch({
    month_days: 0,
    days_count: 0,
    projected_ca: 0,
    reference_type: "breakeven",
    reference_value: 0,
    projected_gap: 0,
    required_daily: 0,
  }),
  salesMix: z.array(z.object({
    name: z.string().catch(""),
    value: z.coerce.number().catch(0),
  })).catch([]),
  cashFlow: z.object({
    cash_sales: z.coerce.number().catch(0),
    cash_movements: z.coerce.number().catch(0),
    cash_purchases: z.coerce.number().catch(0),
    cash_envelope: z.coerce.number().catch(0),
    cash_ratio: z.coerce.number().catch(0),
    anomaly_days: z.coerce.number().catch(0),
  }).catch({
    cash_sales: 0,
    cash_movements: 0,
    cash_purchases: 0,
    cash_envelope: 0,
    cash_ratio: 0,
    anomaly_days: 0,
  }),
  dataQuality: z.object({
    month_days: z.coerce.number().catch(0),
    sales_days: z.coerce.number().catch(0),
    imported_sales_days: z.coerce.number().catch(0),
    manual_sales_days: z.coerce.number().catch(0),
    journal_days: z.coerce.number().catch(0),
    missing_days: z.coerce.number().catch(0),
    anomaly_days: z.coerce.number().catch(0),
    coverage_pct: z.coerce.number().catch(0),
    journal_coverage_pct: z.coerce.number().catch(0),
  }).catch({
    month_days: 0,
    sales_days: 0,
    imported_sales_days: 0,
    manual_sales_days: 0,
    journal_days: 0,
    missing_days: 0,
    anomaly_days: 0,
    coverage_pct: 0,
    journal_coverage_pct: 0,
  }),
  performanceDays: z.array(z.object({
    date: z.string().catch(""),
    ca_total: z.coerce.number().catch(0),
    ca_caisse: z.coerce.number().catch(0),
    ca_b2b: z.coerce.number().catch(0),
    ca_soir: z.coerce.number().catch(0),
    tickets_count: z.coerce.number().catch(0),
    avg_ticket: z.coerce.number().catch(0),
    source: z.enum(["manual", "csv_import"]).catch("manual"),
    has_journal: z.coerce.boolean().catch(false),
    anomaly: z.coerce.boolean().catch(false),
  })).catch([]),
  smartProjection: z.object({
    assumptions: z.object({
      growth_pct: z.coerce.number().catch(0),
      alcool_uplift_pct: z.coerce.number().catch(0),
      caisse_share_pct: z.coerce.number().catch(0),
      alcool_effect_on_total_pct: z.coerce.number().catch(0),
      alcool_effect_month: z.string().catch(""),
    }).catch({
      growth_pct: 0,
      alcool_uplift_pct: 0,
      caisse_share_pct: 0,
      alcool_effect_on_total_pct: 0,
      alcool_effect_month: "",
    }),
    annual: z.array(z.object({
      year: z.coerce.number().catch(0),
      sans_alcool: z.coerce.number().catch(0),
      avec_alcool: z.coerce.number().catch(0),
      delta: z.coerce.number().catch(0),
      objective: z.coerce.number().nullable().catch(null),
      source: z.string().catch(""),
    })).catch([]),
    monthly: z.array(z.object({
      month: z.string().catch(""),
      label: z.string().catch(""),
      sans_alcool: z.coerce.number().catch(0),
      avec_alcool: z.coerce.number().catch(0),
      delta: z.coerce.number().catch(0),
      source: z.string().catch(""),
      alcool_active: z.coerce.boolean().catch(false),
    })).catch([]),
  }).catch({
    assumptions: {
      growth_pct: 0,
      alcool_uplift_pct: 0,
      caisse_share_pct: 0,
      alcool_effect_on_total_pct: 0,
      alcool_effect_month: "",
    },
    annual: [],
    monthly: [],
  }),
  expByLabel: z.array(expenseByLabelSchema).catch([]),
  byCategory: z.array(z.object({ name: z.string().catch(""), value: z.coerce.number().catch(0) })).catch([]),
  last6: z.array(z.object({ month: z.string().catch(""), ca: z.coerce.number().catch(0), objectif: z.coerce.number().nullable().catch(null) })).catch([]),
  notes: z.array(z.object({ date: z.string().catch(""), note: z.string().catch("") })).catch([]),
  staffPayments: z.array(z.object({
    name: z.string().catch(""),
    category: z.string().catch(""),
    payment_day: z.coerce.number().nullable().catch(null),
    theoretical: z.coerce.number().catch(0),
    actual: z.coerce.number().catch(0),
    delta: z.coerce.number().catch(0),
  })).catch([]),
  chargeReconciliation: z.array(z.object({
    name: z.string().catch(""),
    category: z.string().catch(""),
    payment_day: z.coerce.number().nullable().catch(null),
    theoretical: z.coerce.number().catch(0),
    actual: z.coerce.number().catch(0),
    delta: z.coerce.number().catch(0),
  })).catch([]),
  comparison: z.array(z.object({
    month: z.string().catch(""),
    current: z.coerce.number().catch(0),
    previous: z.coerce.number().catch(0),
    delta_pct: z.coerce.number().nullable().catch(null),
  })).catch([]),
  bankConsolidation: bankConsolidationSchema.catch({
    has_data: false,
    banks: [],
    total_debit: 0,
    total_credit: 0,
    import_count: 0,
  }),
  financialConsolidation: financialConsolidationSchema.catch({
    has_data: false,
    ca_pos: 0,
    cash_expenses: 0,
    cash_deposits: 0,
    bank_expenses: 0,
    external_income: 0,
    owner_injections: 0,
    bank_cash_deposits: 0,
    bank_debits: 0,
    bank_credits: 0,
    bank_net: 0,
    real_result: 0,
    owner_support_needed: 0,
    pending_review_count: 0,
    confirmed_count: 0,
    status: "loss",
    alert: "",
    by_classification: [],
  }),
  weekComparison: z.array(weekComparisonItemSchema).catch([]),
  primeCost: z.coerce.number().catch(0),
  resultatNet: z.coerce.number().catch(0),
})

export function parseDashboardState(input: unknown, month: string): {
  kpis: MonthlyKPIs
  delta_ca: number
  delta_expenses: number
  delta_marge: number
  last12: { month: string; ca_caisse: number; ca_b2b: number; ca_total: number; breakeven: number }[]
  hasMonthData: boolean
  monthObjective: {
    target: number | null
    real: number
    pct: number
    remaining: number
    daily_target: number
    note: string
  }
  today: {
    date: string
    ca_caisse: number
    ca_b2b: number
    ca_total: number
    total_expenses: number
    notes: string[]
    status: "missing" | "partial" | "complete"
  }
  cashMonth: {
    month: string
    cash_sales: number
    cash_movements: number
    cash_mp_divers: number
    mp_divers_items: { label: string; amount: number }[]
    cash_charges: number
    cash_rh: number
    cash_depot: number
    cash_purchases: number
    cash_envelope: number
    ca_global: number
    anomaly_days: number
    days_count: number
    prime_cost_pct: number
    resultat_net: number
  }
  weeklyMonth: {
    label: string
    range: string
    ca_total: number
    days_count: number
    ca_per_day: number
    breakeven: number
  }[]
  kpis_secondary: {
    avg_ticket: number
    coverage_pct: number
    mix_cash_pct: number
  }
} {
  const parsed = dashboardStateSchema.parse(input)
  return {
    ...parsed,
    kpis: {
      ...parsed.kpis,
      month: parsed.kpis.month || month,
    },
  }
}

export function parseObjectivesPayload(input: unknown): {
  actions: ActionItem[]
  objectives: Objective[]
  monthlyObjectives: MonthlyObjective[]
  monthlyReal: { year: number; month: number; real: number; target: number; notes: string }[]
} {
  return objectivesPayloadSchema.parse(input)
}

export function parseImportHistoryPayload(input: unknown): {
  history: ImportRecord[]
  monthly_summary: { month: string; days_csv: number; days_manual: number; ca_total: number }[]
} {
  return importHistoryPayloadSchema.parse(input)
}

export function parseWeekPayload(input: unknown): {
  summary: {
    days: {
      date: string
      label: string
      entry: DailyEntry | null
      totalExpenses: number
      status: "empty" | "partial" | "full"
    }[]
    totalCA: number
    totalDep: number
    marge: number
    totalCashSales: number
    totalCashMovements: number
    totalCashEnvelope: number
    cashAnomalyDays: number
    weeklyBreakeven: number
    pctBreakeven: number
    expensesByLabel: { label: string; amount: number }[]
  }
  entries: Record<string, DailyEntry>
} {
  return weekPayloadSchema.parse(input)
}

export function parseReportingPayload(input: unknown) {
  return reportingPayloadSchema.parse(input)
}

export function parseDailyEntry(input: unknown): DailyEntry {
  return dailyEntrySchema.parse(input)
}

export function parseImportType(input: unknown): ImportType {
  return z.enum(["sales_csv", "cash_journal_xls"]).parse(input)
}

export function parseChargesPayload(input: unknown): { charges: FixedCharge[] } {
  return z.object({ charges: z.array(z.object({
    id: z.string().catch(""),
    name: z.string().catch(""),
    category: z.string().catch("DIVERS"),
    amount: z.coerce.number().catch(0),
    type: z.enum(["fixed", "variable", "semi-fixed"]).catch("fixed"),
    payment_day: z.coerce.number().nullable().catch(null),
    is_staff: z.coerce.boolean().catch(false),
    is_active: z.coerce.boolean().catch(false),
    start_date: z.string().catch(""),
    end_date: z.string().nullable().catch(null),
  })).catch([]) }).parse(input)
}

export function parseCreateChargeBody(input: unknown): {
  name: string
  category: string
  amount: number
  type: "fixed" | "variable" | "semi-fixed"
  payment_day: number | null
  is_staff: boolean
} {
  return z.object({
    name: z.string().min(1),
    category: z.string().min(1),
    amount: z.coerce.number().min(0),
    type: z.enum(["fixed", "variable", "semi-fixed"]).default("fixed"),
    payment_day: z.coerce.number().nullable().default(null),
    is_staff: z.coerce.boolean().default(false),
  }).parse(input)
}

export type ParsedExpenseItem = ExpenseItem

export function parseCreateActionBody(input: unknown): {
  lever: ActionItem["lever"]
  title: string
  description: string
  priority: ActionItem["priority"]
  deadline: string
  budget_min: number
  budget_max: number
  impact: string
} {
  return z.object({
    lever: z.enum(["soir", "terrasse", "b2b", "marketing", "pilotage"]),
    title: z.string().min(1),
    description: z.string().default(""),
    priority: z.enum(["urgent", "medium", "low"]).default("medium"),
    deadline: z.string().default(""),
    budget_min: z.coerce.number().min(0).default(0),
    budget_max: z.coerce.number().min(0).default(0),
    impact: z.string().default(""),
  }).parse(input)
}

export function parseUpdateActionBody(input: unknown): {
  id: string
  lever?: ActionItem["lever"]
  title?: string
  description?: string
  priority?: ActionItem["priority"]
  deadline?: string
  budget_min?: number
  budget_max?: number
  impact?: string
  status?: ActionItem["status"]
} {
  return z.object({
    id: z.string().min(1),
    lever: z.enum(["soir", "terrasse", "b2b", "marketing", "pilotage"]).optional(),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    priority: z.enum(["urgent", "medium", "low"]).optional(),
    deadline: z.string().optional(),
    budget_min: z.coerce.number().min(0).optional(),
    budget_max: z.coerce.number().min(0).optional(),
    impact: z.string().optional(),
    status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
  }).parse(input)
}

export function parseExpenseTemplatesPayload(raw: unknown): { sections: ExpenseSection[] } {
  if (!raw || typeof raw !== "object") return { sections: [] }
  const obj = raw as Record<string, unknown>
  const sections = Array.isArray(obj.sections) ? obj.sections : []
  return {
    sections: sections.map((s: any) => ({
      id: String(s.id ?? ""),
      name: String(s.name ?? ""),
      emoji: String(s.emoji ?? "📦"),
      expense_category: (["MP", "CHARGES", "AUTRE"].includes(s.expense_category) ? s.expense_category : "AUTRE") as "MP" | "CHARGES" | "AUTRE",
      sort_order: Number(s.sort_order ?? 0),
      is_active: Boolean(s.is_active ?? true),
      items: Array.isArray(s.items) ? s.items.map((t: any) => ({
        id: String(t.id ?? ""),
        section_id: String(t.section_id ?? ""),
        label: String(t.label ?? ""),
        is_active: Boolean(t.is_active ?? true),
        sort_order: Number(t.sort_order ?? 0),
      })) : [],
    })),
  }
}
