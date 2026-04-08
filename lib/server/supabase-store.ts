import "server-only"

import {
  ACTION_ITEMS,
  DAILY_ENTRIES_2026,
  FIXED_CHARGES,
  IMPORT_HISTORY,
  MONTHLY_CA_2025,
  MONTHLY_CA_2026,
  MONTHLY_OBJECTIVES_2026,
  OBJECTIVES,
} from "@/lib/mock-data"
import type {
  ActionItem,
  DailyEntry,
  FixedCharge,
  ImportRecord,
  MonthlyObjective,
  Objective,
} from "@/lib/types"
import type { DailySaleRecord, ExpenseRecord, PilotDb } from "@/lib/server/pilot-store"

type SupabaseClientLike = {
  from: (_table: string) => any
}

function nowIso() {
  return new Date().toISOString()
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function toMonthParts(month: string) {
  const [year, rawMonth] = month.split("-").map(Number)
  return { year, monthIndex: rawMonth - 1 }
}

function distributeMonthlySales(month: string, caCaisse: number, caB2b: number) {
  const { year, monthIndex } = toMonthParts(month)
  const totalDays = daysInMonth(year, monthIndex)
  const updatedAt = nowIso()
  const caisseBase = Math.floor((caCaisse / totalDays) * 100) / 100
  const b2bBase = Math.floor((caB2b / totalDays) * 100) / 100
  const caisseLast = Math.round((caCaisse - caisseBase * (totalDays - 1)) * 100) / 100
  const b2bLast = Math.round((caB2b - b2bBase * (totalDays - 1)) * 100) / 100

  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(year, monthIndex, index + 1)
    const isLast = index === totalDays - 1
    return {
      date: date.toISOString().slice(0, 10),
      ca_caisse: isLast ? caisseLast : caisseBase,
      ca_b2b: isLast ? b2bLast : b2bBase,
      ca_soir: 0,
      pct_soir: 0,
      tickets_count: 0,
      notes: "Seed historique Alaska",
      source: "manual",
      import_id: null,
      created_by: null,
      updated_at: updatedAt,
    }
  })
}

function buildSeedPayloads(userId: string | null) {
  const seededSales = [
    ...Object.entries(MONTHLY_CA_2025).flatMap(([month, value]) =>
      distributeMonthlySales(month, value.ca_caisse, value.ca_b2b)
    ),
    ...Object.entries(MONTHLY_CA_2026)
      .filter(([month]) => month !== "2026-04")
      .flatMap(([month, value]) => distributeMonthlySales(month, value.ca_caisse, value.ca_b2b)),
  ]

  const detailedSales = Object.values(DAILY_ENTRIES_2026).map((entry) => ({
    date: entry.date,
    ca_caisse: entry.ca_caisse,
    ca_b2b: entry.ca_b2b,
    ca_soir: entry.ca_soir,
    pct_soir: entry.pct_soir,
    tickets_count: entry.tickets_count,
    notes: entry.notes,
    source: entry.source,
    import_id: null,
    created_by: userId,
    updated_at: nowIso(),
  }))

  const detailedByDate = new Set(detailedSales.map((item) => item.date))
  const dailySales = [...seededSales.filter((item) => !detailedByDate.has(item.date)), ...detailedSales]

  const expenses = Object.values(DAILY_ENTRIES_2026).flatMap((entry) =>
    entry.expenses.map((expense) => ({
      date: entry.date,
      category: expense.category,
      label: expense.label,
      amount: expense.amount,
      notes: expense.notes || "",
      created_by: userId,
      updated_at: nowIso(),
    }))
  )

  const fixedCharges = FIXED_CHARGES.map((charge) => ({
    name: charge.name,
    category: charge.category,
    amount: charge.amount,
    type: charge.type,
    payment_day: charge.payment_day,
    is_staff: charge.is_staff,
    is_active: charge.is_active,
    start_date: charge.start_date,
    end_date: charge.end_date,
    notes: null,
  }))

  const objectives = OBJECTIVES.map((objective) => ({
    year: objective.year,
    type: objective.type,
    target_amount: objective.target_amount,
    scenario: objective.scenario,
    notes: null,
    created_by: userId,
  }))

  const monthlyObjectives = MONTHLY_OBJECTIVES_2026.map((objective) => ({
    year: objective.year,
    month: objective.month,
    target_ca: objective.target_ca,
    target_b2b: null,
    notes: objective.notes || null,
  }))

  const actionItems = ACTION_ITEMS.map((item, index) => ({
    lever: item.lever,
    title: item.title,
    description: item.description,
    priority: item.priority,
    deadline: item.deadline,
    budget_min: item.budget_min,
    budget_max: item.budget_max,
    impact: item.impact,
    status: item.status,
    sort_order: index,
    created_by: userId,
  }))

  const imports = IMPORT_HISTORY.map((item) => ({
    filename: item.filename,
    storage_path: null,
    imported_by: userId,
    imported_at: item.imported_at,
    rows_processed: item.rows_processed,
    days_imported: item.days_imported,
    date_range_start: item.date_range_start,
    date_range_end: item.date_range_end,
    ca_total: item.ca_total,
    status: item.status,
    error_message: null,
  }))

  return { dailySales, expenses, fixedCharges, objectives, monthlyObjectives, actionItems, imports }
}

function requireData<T>(data: T | null, error: { message?: string } | null, fallback: T): T {
  if (error) throw new Error(error.message || "Erreur Supabase")
  return data ?? fallback
}

function mapDailySale(row: any): DailySaleRecord {
  return {
    id: String(row.id),
    date: String(row.date),
    ca_caisse: Number(row.ca_caisse || 0),
    ca_b2b: Number(row.ca_b2b || 0),
    ca_soir: Number(row.ca_soir || 0),
    pct_soir: Number(row.pct_soir || 0),
    tickets_count: Number(row.tickets_count || 0),
    notes: String(row.notes || ""),
    source: row.source === "csv_import" ? "csv_import" : "manual",
    import_id: row.import_id ? String(row.import_id) : null,
    created_by: row.created_by ? String(row.created_by) : null,
    updated_at: String(row.updated_at || row.created_at || nowIso()),
  }
}

function mapExpense(row: any): ExpenseRecord {
  return {
    id: String(row.id),
    date: String(row.date),
    category: row.category,
    label: String(row.label || ""),
    amount: Number(row.amount || 0),
    notes: String(row.notes || ""),
    created_by: row.created_by ? String(row.created_by) : null,
    updated_at: String(row.updated_at || row.created_at || nowIso()),
  }
}

function mapFixedCharge(row: any): FixedCharge {
  return {
    id: String(row.id),
    name: String(row.name),
    category: row.category,
    amount: Number(row.amount || 0),
    type: row.type,
    payment_day: row.payment_day === null ? null : Number(row.payment_day),
    is_staff: Boolean(row.is_staff),
    is_active: Boolean(row.is_active),
    start_date: String(row.start_date),
    end_date: row.end_date ? String(row.end_date) : null,
  }
}

function mapObjective(row: any): Objective {
  return {
    id: String(row.id),
    year: Number(row.year),
    type: row.type,
    target_amount: Number(row.target_amount || 0),
    scenario: row.scenario,
  }
}

function mapMonthlyObjective(row: any): MonthlyObjective {
  return {
    year: Number(row.year),
    month: Number(row.month),
    target_ca: Number(row.target_ca || 0),
    notes: row.notes ? String(row.notes) : undefined,
  }
}

function mapActionItem(row: any): ActionItem {
  return {
    id: String(row.id),
    lever: row.lever,
    title: String(row.title),
    description: String(row.description || ""),
    priority: row.priority,
    deadline: String(row.deadline || ""),
    budget_min: Number(row.budget_min || 0),
    budget_max: Number(row.budget_max || 0),
    impact: String(row.impact || ""),
    status: row.status,
  }
}

function mapImportRecord(row: any): ImportRecord {
  return {
    id: String(row.id),
    filename: String(row.filename || ""),
    imported_at: String(row.imported_at || nowIso()),
    rows_processed: Number(row.rows_processed || 0),
    days_imported: Number(row.days_imported || 0),
    date_range_start: String(row.date_range_start || ""),
    date_range_end: String(row.date_range_end || ""),
    ca_total: Number(row.ca_total || 0),
    status: row.status === "error" ? "error" : row.status === "partial" ? "partial" : "success",
  }
}

export async function ensureSeedData(client: SupabaseClientLike, userId: string | null) {
  const { count, error } = await client.from("daily_sales").select("id", { count: "exact", head: true })
  if (error) throw new Error(error.message)
  if ((count || 0) > 0) return

  const payloads = buildSeedPayloads(userId)

  const inserts = [
    client.from("pos_imports").insert(payloads.imports),
    client.from("fixed_charges").insert(payloads.fixedCharges),
    client.from("objectives").upsert(payloads.objectives, { onConflict: "year,type,scenario" }),
    client.from("monthly_objectives").upsert(payloads.monthlyObjectives, { onConflict: "year,month" }),
    client.from("action_items").insert(payloads.actionItems),
    client.from("daily_sales").upsert(payloads.dailySales, { onConflict: "date" }),
    client.from("expenses").insert(payloads.expenses),
  ]

  const results = await Promise.all(inserts)
  const failed = results.find((result) => result.error)
  if (failed?.error) throw new Error(failed.error.message)
}

export async function readSnapshot(client: SupabaseClientLike, options?: { seedIfEmpty?: boolean; userId?: string | null }): Promise<PilotDb> {
  if (options?.seedIfEmpty) {
    await ensureSeedData(client, options.userId || null)
  }

  const [salesRes, expensesRes, chargesRes, objectivesRes, monthlyRes, actionsRes, importsRes] = await Promise.all([
    client.from("daily_sales").select("*").order("date", { ascending: true }),
    client.from("expenses").select("*").order("date", { ascending: true }),
    client.from("fixed_charges").select("*").order("category", { ascending: true }).order("name", { ascending: true }),
    client.from("objectives").select("*").order("year", { ascending: true }),
    client.from("monthly_objectives").select("*").order("year", { ascending: true }).order("month", { ascending: true }),
    client.from("action_items").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    client.from("pos_imports").select("*").order("imported_at", { ascending: false }),
  ])

  return {
    users: [],
    daily_sales: requireData(salesRes.data, salesRes.error, []).map(mapDailySale),
    expenses: requireData(expensesRes.data, expensesRes.error, []).map(mapExpense),
    fixed_charges: requireData(chargesRes.data, chargesRes.error, []).map(mapFixedCharge),
    objectives: requireData(objectivesRes.data, objectivesRes.error, []).map(mapObjective),
    monthly_objectives: requireData(monthlyRes.data, monthlyRes.error, []).map(mapMonthlyObjective),
    action_items: requireData(actionsRes.data, actionsRes.error, []).map(mapActionItem),
    import_history: requireData(importsRes.data, importsRes.error, []).map(mapImportRecord),
  }
}

export function toDailyEntry(sale: DailySaleRecord | null, expenses: ExpenseRecord[], date: string): DailyEntry {
  return {
    date,
    ca_caisse: sale?.ca_caisse ?? 0,
    ca_b2b: sale?.ca_b2b ?? 0,
    ca_soir: sale?.ca_soir ?? 0,
    pct_soir: sale?.pct_soir ?? 0,
    tickets_count: sale?.tickets_count ?? 0,
    notes: sale?.notes ?? "",
    source: sale?.source ?? "manual",
    expenses: expenses.map((expense) => ({
      id: expense.id,
      category: expense.category,
      label: expense.label,
      amount: expense.amount,
      notes: expense.notes || undefined,
    })),
  }
}

export async function getDailyEntry(client: SupabaseClientLike, date: string) {
  const [{ data: sales, error: saleError }, { data: expenses, error: expenseError }] = await Promise.all([
    client.from("daily_sales").select("*").eq("date", date).limit(1),
    client.from("expenses").select("*").eq("date", date).order("created_at", { ascending: true }),
  ])

  if (saleError) throw new Error(saleError.message)
  if (expenseError) throw new Error(expenseError.message)

  return toDailyEntry(sales?.[0] ? mapDailySale(sales[0]) : null, (expenses || []).map(mapExpense), date)
}

export async function saveDailyEntry(client: SupabaseClientLike, entry: DailyEntry, userId: string) {
  const salePayload = {
    date: entry.date,
    ca_caisse: entry.ca_caisse,
    ca_b2b: entry.ca_b2b,
    ca_soir: entry.ca_soir,
    pct_soir: entry.pct_soir,
    tickets_count: entry.tickets_count,
    notes: entry.notes,
    source: entry.source,
    created_by: userId,
    updated_at: nowIso(),
  }

  const saleResult = await client.from("daily_sales").upsert(salePayload, { onConflict: "date" })
  if (saleResult.error) throw new Error(saleResult.error.message)

  const deleteResult = await client.from("expenses").delete().eq("date", entry.date)
  if (deleteResult.error) throw new Error(deleteResult.error.message)

  const rows = entry.expenses
    .filter((expense) => expense.amount > 0)
    .map((expense) => ({
      date: entry.date,
      category: expense.category,
      label: expense.label,
      amount: expense.amount,
      notes: expense.notes || "",
      created_by: userId,
      updated_at: nowIso(),
    }))

  if (rows.length > 0) {
    const insertResult = await client.from("expenses").insert(rows)
    if (insertResult.error) throw new Error(insertResult.error.message)
  }

  return getDailyEntry(client, entry.date)
}

export async function updateFixedCharge(client: SupabaseClientLike, payload: { id: string; amount?: number; is_active?: boolean }) {
  const patch: Record<string, unknown> = { updated_at: nowIso() }
  if (typeof payload.amount === "number") patch.amount = payload.amount
  if (typeof payload.is_active === "boolean") patch.is_active = payload.is_active

  const result = await client.from("fixed_charges").update(patch).eq("id", payload.id)
  if (result.error) throw new Error(result.error.message)

  const { data, error } = await client.from("fixed_charges").select("*").order("category", { ascending: true }).order("name", { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []).map(mapFixedCharge)
}

export async function updateActionStatus(client: SupabaseClientLike, payload: { id: string; status: ActionItem["status"] }) {
  const patch: Record<string, unknown> = {
    status: payload.status,
    updated_at: nowIso(),
    completed_at: payload.status === "done" ? nowIso() : null,
  }

  const result = await client.from("action_items").update(patch).eq("id", payload.id)
  if (result.error) throw new Error(result.error.message)

  const { data, error } = await client.from("action_items").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []).map(mapActionItem)
}
