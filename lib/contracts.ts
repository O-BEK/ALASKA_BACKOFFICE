import { z } from "zod"
import type {
  ActionItem,
  DailyEntry,
  ExpenseItem,
  FixedCharge,
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
  last12: z.array(dashboardLast12Schema).catch([]),
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
    weeklyBreakeven: 0,
    pctBreakeven: 0,
    expensesByLabel: [],
  }),
  entries: weekEntriesSchema,
})

const reportingPayloadSchema = z.object({
  monthCA: z.coerce.number().catch(0),
  prevCA: z.coerce.number().catch(0),
  monthExp: z.coerce.number().catch(0),
  expByLabel: z.array(expenseByLabelSchema).catch([]),
  byCategory: z.array(z.object({ name: z.string().catch(""), value: z.coerce.number().catch(0) })).catch([]),
  pctSeuil: z.coerce.number().catch(0),
  soldeMois: z.coerce.number().catch(0),
  last6: z.array(z.object({ month: z.string().catch(""), ca: z.coerce.number().catch(0), objectif: z.coerce.number().nullable().catch(null) })).catch([]),
})

export function parseDashboardState(input: unknown, month: string): {
  kpis: MonthlyKPIs
  delta_ca: number
  last12: { month: string; ca_caisse: number; ca_b2b: number; ca_total: number; breakeven: number }[]
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
