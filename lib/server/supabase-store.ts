import "server-only"

import type {
  ActionItem,
  DailyEntry,
  ExpenseSection,
  FixedCharge,
  ImportRecord,
  MonthlyObjective,
  Objective,
} from "@/lib/types"
import type { DailySaleRecord, ExpenseRecord, PilotDb } from "@/lib/server/db-types"

type SupabaseClientLike = {
  from: (_table: string) => any
}

function isMissingTableError(error: { message?: string } | null | undefined, table: string) {
  const message = error?.message || ""
  return message.includes(`Could not find the table 'public.${table}'`) || message.includes(`relation "public.${table}" does not exist`)
}

function nowIso() {
  return new Date().toISOString()
}

function safeData<T>(data: T | null, error: { message?: string } | null, fallback: T, table: string): T {
  if (error) {
    console.error(`[supabase-store] ${table}:`, error.message)
    return fallback
  }
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
    mouvement_caisse: Number(row.mouvement_caisse || 0),
    cash_sales_journal: row.cash_sales_journal === null || row.cash_sales_journal === undefined ? null : Number(row.cash_sales_journal),
    cash_movements_journal: row.cash_movements_journal === null || row.cash_movements_journal === undefined ? null : Number(row.cash_movements_journal),
    cash_opening_fund: row.cash_opening_fund === null || row.cash_opening_fund === undefined ? null : Number(row.cash_opening_fund),
    cash_closing_fund: row.cash_closing_fund === null || row.cash_closing_fund === undefined ? null : Number(row.cash_closing_fund),
    cash_journal_sessions: Number(row.cash_journal_sessions || 0),
    cash_journal_anomaly: Boolean(row.cash_journal_anomaly),
    cash_journal_import_id: row.cash_journal_import_id ? String(row.cash_journal_import_id) : null,
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
    storage_path: row.storage_path ? String(row.storage_path) : null,
    import_type: row.import_type === "cash_journal_xls" ? "cash_journal_xls" : "sales_csv",
    imported_at: String(row.imported_at || nowIso()),
    rows_processed: Number(row.rows_processed || 0),
    days_imported: Number(row.days_imported || 0),
    date_range_start: String(row.date_range_start || ""),
    date_range_end: String(row.date_range_end || ""),
    ca_total: Number(row.ca_total || 0),
    status: row.status === "error" ? "error" : row.status === "partial" ? "partial" : "success",
  }
}

export async function readSnapshot(client: SupabaseClientLike): Promise<PilotDb> {
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
    daily_sales: safeData(salesRes.data, salesRes.error, [], "daily_sales").map(mapDailySale),
    expenses: safeData(expensesRes.data, expensesRes.error, [], "expenses").map(mapExpense),
    fixed_charges: safeData(chargesRes.data, chargesRes.error, [], "fixed_charges").map(mapFixedCharge),
    objectives: safeData(objectivesRes.data, objectivesRes.error, [], "objectives").map(mapObjective),
    monthly_objectives: safeData(monthlyRes.data, monthlyRes.error, [], "monthly_objectives").map(mapMonthlyObjective),
    action_items: safeData(actionsRes.data, actionsRes.error, [], "action_items").map(mapActionItem),
    import_history: isMissingTableError(importsRes.error, "pos_imports")
      ? []
      : safeData(importsRes.data, importsRes.error, [], "pos_imports").map(mapImportRecord),
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
    mouvement_caisse: sale?.mouvement_caisse ?? 0,
    cash_sales_journal: sale?.cash_sales_journal ?? null,
    cash_movements_journal: sale?.cash_movements_journal ?? null,
    cash_opening_fund: sale?.cash_opening_fund ?? null,
    cash_closing_fund: sale?.cash_closing_fund ?? null,
    cash_journal_sessions: sale?.cash_journal_sessions ?? 0,
    cash_journal_anomaly: sale?.cash_journal_anomaly ?? false,
    cash_journal_import_id: sale?.cash_journal_import_id ?? null,
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
  const existingResult = await client.from("daily_sales").select("*").eq("date", entry.date).limit(1)
  if (existingResult.error) throw new Error(existingResult.error.message)
  const existing = existingResult.data?.[0] ? mapDailySale(existingResult.data[0]) : null

  const salePayload = {
    date: entry.date,
    ca_caisse: existing?.ca_caisse ?? entry.ca_caisse,
    ca_b2b: existing?.ca_b2b ?? entry.ca_b2b,
    ca_soir: existing?.ca_soir ?? entry.ca_soir,
    pct_soir: existing?.pct_soir ?? entry.pct_soir,
    tickets_count: existing?.tickets_count ?? entry.tickets_count,
    mouvement_caisse: existing?.mouvement_caisse ?? entry.mouvement_caisse ?? 0,
    cash_sales_journal: existing?.cash_sales_journal ?? null,
    cash_movements_journal: existing?.cash_movements_journal ?? null,
    cash_opening_fund: existing?.cash_opening_fund ?? null,
    cash_closing_fund: existing?.cash_closing_fund ?? null,
    cash_journal_sessions: existing?.cash_journal_sessions ?? 0,
    cash_journal_anomaly: existing?.cash_journal_anomaly ?? false,
    cash_journal_import_id: existing?.cash_journal_import_id ?? null,
    notes: entry.notes,
    source: existing?.source ?? entry.source,
    import_id: existing?.import_id ?? null,
    created_by: existing?.created_by ?? userId,
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

export async function updateFixedCharge(
  client: SupabaseClientLike,
  payload: { id: string; amount?: number; is_active?: boolean; changed_by?: string | null }
) {
  const currentResult = await client
    .from("fixed_charges")
    .select("id, amount, is_active")
    .eq("id", payload.id)
    .single()
  if (currentResult.error) throw new Error(currentResult.error.message)

  const current = currentResult.data
  const oldAmount = Number(current?.amount || 0)
  const newAmount = typeof payload.amount === "number" ? payload.amount : oldAmount
  const oldActive = Boolean(current?.is_active)
  const newActive = typeof payload.is_active === "boolean" ? payload.is_active : oldActive

  const patch: Record<string, unknown> = { updated_at: nowIso() }
  if (typeof payload.amount === "number") patch.amount = payload.amount
  if (typeof payload.is_active === "boolean") patch.is_active = payload.is_active

  const result = await client.from("fixed_charges").update(patch).eq("id", payload.id)
  if (result.error) throw new Error(result.error.message)

  const shouldRecordHistory = typeof payload.amount === "number" || typeof payload.is_active === "boolean"
  if (shouldRecordHistory) {
    const reasons = []
    if (newAmount !== oldAmount) reasons.push("amount")
    if (newActive !== oldActive) reasons.push(newActive ? "reactivation" : "deactivation")

    const historyResult = await client.from("charge_history").insert({
      charge_id: payload.id,
      old_amount: oldAmount,
      new_amount: newAmount,
      changed_by: payload.changed_by || null,
      reason: reasons.length > 0 ? reasons.join(",") : "update",
      effective_date: new Date().toISOString().slice(0, 10),
    })
    if (historyResult.error) throw new Error(historyResult.error.message)
  }

  const { data, error } = await client.from("fixed_charges").select("*").order("category", { ascending: true }).order("name", { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []).map(mapFixedCharge)
}

export async function createFixedCharge(
  client: SupabaseClientLike,
  payload: {
    name: string
    category: string
    amount: number
    type: string
    payment_day: number | null
    is_staff: boolean
  }
) {
  const row = {
    name: payload.name,
    category: payload.category,
    amount: payload.amount,
    type: payload.type,
    payment_day: payload.payment_day,
    is_staff: payload.is_staff,
    is_active: true,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: null,
    notes: null,
    updated_at: nowIso(),
  }

  const result = await client.from("fixed_charges").insert(row)
  if (result.error) throw new Error(result.error.message)

  const { data, error } = await client
    .from("fixed_charges")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true })
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

export async function createActionItem(
  client: SupabaseClientLike,
  payload: {
    lever: string; title: string; description: string
    priority: string; deadline: string
    budget_min: number; budget_max: number; impact: string
    userId: string
  }
): Promise<ActionItem[]> {
  const { data: last } = await client.from("action_items")
    .select("sort_order").order("sort_order", { ascending: false }).limit(1)
  const nextOrder = ((last?.[0]?.sort_order) ?? 0) + 1
  const { error } = await client.from("action_items").insert({
    lever: payload.lever, title: payload.title, description: payload.description,
    priority: payload.priority, deadline: payload.deadline,
    budget_min: payload.budget_min, budget_max: payload.budget_max,
    impact: payload.impact, status: "todo",
    sort_order: nextOrder, created_by: payload.userId,
  })
  if (error) throw new Error(error.message)
  const { data, error: fetchErr } = await client.from("action_items")
    .select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true })
  if (fetchErr) throw new Error(fetchErr.message)
  return (data || []).map(mapActionItem)
}

export async function updateActionItem(
  client: SupabaseClientLike,
  payload: { id: string; [key: string]: unknown }
): Promise<ActionItem[]> {
  const { id, ...fields } = payload
  const patch: Record<string, unknown> = { updated_at: nowIso() }
  const allowed = ["lever", "title", "description", "priority", "deadline", "budget_min", "budget_max", "impact", "status"]
  for (const key of allowed) {
    if (fields[key] !== undefined) patch[key] = fields[key]
  }
  if (patch.status === "done") patch.completed_at = nowIso()
  const { error } = await client.from("action_items").update(patch).eq("id", id)
  if (error) throw new Error(error.message)
  const { data, error: fetchErr } = await client.from("action_items")
    .select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true })
  if (fetchErr) throw new Error(fetchErr.message)
  return (data || []).map(mapActionItem)
}

export async function deleteActionItem(
  client: SupabaseClientLike,
  id: string
): Promise<ActionItem[]> {
  const { error } = await client.from("action_items").delete().eq("id", id)
  if (error) throw new Error(error.message)
  const { data, error: fetchErr } = await client.from("action_items")
    .select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true })
  if (fetchErr) throw new Error(fetchErr.message)
  return (data || []).map(mapActionItem)
}

export async function updateMonthlyObjective(
  client: SupabaseClientLike,
  year: number, month: number, target_ca: number
): Promise<MonthlyObjective[]> {
  const { error } = await client.from("monthly_objectives")
    .update({ target_ca })
    .eq("year", year).eq("month", month)
  if (error) throw new Error(error.message)
  const { data, error: fetchErr } = await client.from("monthly_objectives")
    .select("*").order("year", { ascending: true }).order("month", { ascending: true })
  if (fetchErr) throw new Error(fetchErr.message)
  return (data || []).map(mapMonthlyObjective)
}

export async function applyAlcoolLicenseUplift(
  client: SupabaseClientLike,
  payload: { actionId: string; effectMonth: string; upliftPct: number }
) {
  // 1. Fetch all monthly_objectives
  const { data: rows, error } = await client
    .from("monthly_objectives")
    .select("*")
    .order("year", { ascending: true })
    .order("month", { ascending: true })
  if (error) throw new Error(error.message)

  // 2. Apply uplift to months >= effectMonth
  const [effYear, effMonth] = payload.effectMonth.split("-").map(Number)
  const multiplier = 1 + payload.upliftPct / 100

  const toUpdate = (rows || []).filter((row: any) => {
    if (row.year > effYear) return true
    if (row.year === effYear && row.month >= effMonth) return true
    return false
  })

  for (const row of toUpdate) {
    const newTarget = Math.round(Number(row.target_ca) * multiplier)
    const { error: updateErr } = await client
      .from("monthly_objectives")
      .update({ target_ca: newTarget, notes: `${row.notes || ""} [+${payload.upliftPct}% alcool]`.trim() })
      .eq("year", row.year)
      .eq("month", row.month)
    if (updateErr) throw new Error(updateErr.message)
  }

  // 3. Recalculate realistic annual objective for effYear
  const { data: updatedRows } = await client
    .from("monthly_objectives")
    .select("*")
    .eq("year", effYear)
  const annualSum = (updatedRows || []).reduce((s: number, r: any) => s + Number(r.target_ca), 0)
  await client
    .from("objectives")
    .update({ target_amount: annualSum, updated_at: nowIso() })
    .eq("year", effYear)
    .eq("scenario", "realistic")
    .eq("type", "ca_total")

  // 4. Mark action as done + store metadata
  const { error: actionErr } = await client
    .from("action_items")
    .update({
      status: "done",
      completed_at: nowIso(),
      updated_at: nowIso(),
      metadata: { alcool_uplift_pct: payload.upliftPct, alcool_effect_month: payload.effectMonth },
    })
    .eq("id", payload.actionId)
  if (actionErr) throw new Error(actionErr.message)

  // 5. Return updated monthly_objectives
  const { data: finalRows, error: finalErr } = await client
    .from("monthly_objectives")
    .select("*")
    .order("year", { ascending: true })
    .order("month", { ascending: true })
  if (finalErr) throw new Error(finalErr.message)
  return (finalRows || []).map(mapMonthlyObjective)
}

export async function getExpenseSections(supabase: SupabaseClientLike): Promise<ExpenseSection[]> {
  const { data: sections, error: secErr } = await supabase
    .from("expense_sections")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")

  if (secErr) throw new Error(secErr.message)

  const { data: items, error: itemErr } = await supabase
    .from("expense_item_templates")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")

  if (itemErr) throw new Error(itemErr.message)

  return (sections || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    emoji: s.emoji,
    expense_category: s.expense_category,
    sort_order: s.sort_order,
    is_active: s.is_active,
    items: (items || []).filter((t: any) => t.section_id === s.id),
  }))
}

export async function createExpenseSection(
  supabase: SupabaseClientLike,
  payload: { name: string; emoji: string; expense_category: "MP" | "CHARGES" | "AUTRE" }
): Promise<ExpenseSection[]> {
  const { data: existing } = await supabase
    .from("expense_sections")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
  const nextOrder = ((existing?.[0]?.sort_order) ?? 0) + 1
  const { error: insertErr } = await supabase.from("expense_sections").insert({ ...payload, sort_order: nextOrder })
  if (insertErr) throw new Error(insertErr.message)
  return getExpenseSections(supabase)
}

export async function deleteExpenseSection(
  supabase: SupabaseClientLike,
  id: string
): Promise<ExpenseSection[]> {
  const { error: deleteErr } = await supabase.from("expense_sections").delete().eq("id", id)
  if (deleteErr) throw new Error(deleteErr.message)
  return getExpenseSections(supabase)
}

export async function createExpenseItem(
  supabase: SupabaseClientLike,
  payload: { section_id: string; label: string }
): Promise<ExpenseSection[]> {
  const { data: existing } = await supabase
    .from("expense_item_templates")
    .select("sort_order")
    .eq("section_id", payload.section_id)
    .order("sort_order", { ascending: false })
    .limit(1)
  const nextOrder = ((existing?.[0]?.sort_order) ?? 0) + 1
  const { error: insertErr } = await supabase.from("expense_item_templates").insert({ ...payload, sort_order: nextOrder })
  if (insertErr) throw new Error(insertErr.message)
  return getExpenseSections(supabase)
}

export async function deleteExpenseItem(
  supabase: SupabaseClientLike,
  id: string
): Promise<ExpenseSection[]> {
  const { error: deleteErr } = await supabase.from("expense_item_templates").delete().eq("id", id)
  if (deleteErr) throw new Error(deleteErr.message)
  return getExpenseSections(supabase)
}
