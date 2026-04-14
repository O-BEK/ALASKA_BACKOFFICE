#!/usr/bin/env node

/**
 * Seed explicite des données de démonstration Alaska.
 *
 * Usage :
 *   node --env-file=.env.local scripts/seed-demo-data.mjs
 *
 * Variables requises :
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { createRequire } from "module"
import vm from "vm"

const require = createRequire(import.meta.url)
const ts = require("typescript")

function loadMockData() {
  const source = readFileSync(new URL("../lib/mock-data.ts", import.meta.url), "utf8")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  })
  const module = { exports: {} }
  vm.runInNewContext(outputText, { exports: module.exports, module, require }, { filename: "lib/mock-data.ts" })
  return module.exports
}

const {
  ACTION_ITEMS,
  DAILY_ENTRIES_2026,
  FIXED_CHARGES,
  IMPORT_HISTORY,
  MONTHLY_CA_2025,
  MONTHLY_CA_2026,
  MONTHLY_OBJECTIVES_2026,
  OBJECTIVES,
} = loadMockData()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const userId = process.env.SEED_USER_ID || null

if (!url || !serviceRoleKey) {
  console.error("Variables manquantes pour le seed de démonstration :")
  if (!url) console.error(" - NEXT_PUBLIC_SUPABASE_URL")
  if (!serviceRoleKey) console.error(" - SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

function isMissingTableError(error, table) {
  const message = error?.message || ""
  return message.includes(`Could not find the table 'public.${table}'`) || message.includes(`relation "public.${table}" does not exist`)
}

function nowIso() {
  return new Date().toISOString()
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function toMonthParts(month) {
  const [year, rawMonth] = month.split("-").map(Number)
  return { year, monthIndex: rawMonth - 1 }
}

function distributeMonthlySales(month, caCaisse, caB2b) {
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
      mouvement_caisse: 0,
      cash_sales_journal: null,
      cash_movements_journal: null,
      cash_opening_fund: null,
      cash_closing_fund: null,
      cash_journal_sessions: 0,
      cash_journal_anomaly: false,
      cash_journal_import_id: null,
      notes: "Seed historique Alaska",
      source: "manual",
      import_id: null,
      created_by: null,
      updated_at: updatedAt,
    }
  })
}

function buildSeedPayloads(seedUserId) {
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
    mouvement_caisse: entry.mouvement_caisse ?? 0,
    cash_sales_journal: null,
    cash_movements_journal: null,
    cash_opening_fund: null,
    cash_closing_fund: null,
    cash_journal_sessions: 0,
    cash_journal_anomaly: false,
    cash_journal_import_id: null,
    notes: entry.notes,
    source: entry.source,
    import_id: null,
    created_by: seedUserId,
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
      created_by: seedUserId,
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
    created_by: seedUserId,
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
    created_by: seedUserId,
  }))

  const imports = IMPORT_HISTORY.map((item) => ({
    filename: item.filename,
    import_type: item.import_type,
    storage_path: null,
    imported_by: seedUserId,
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

async function seedDemoData(client, seedUserId) {
  const [salesRes, actionsRes] = await Promise.all([
    client.from("daily_sales").select("id", { count: "exact", head: true }),
    client.from("action_items").select("id", { count: "exact", head: true }),
  ])

  if (salesRes.error) console.error("[seed-demo-data] daily_sales count:", salesRes.error.message)
  if (actionsRes.error) console.error("[seed-demo-data] action_items count:", actionsRes.error.message)

  const salesCount = salesRes.error ? -1 : (salesRes.count || 0)
  const actionsCount = actionsRes.error ? -1 : (actionsRes.count || 0)

  if (salesCount > 0 && actionsCount > 0) {
    console.log("Données déjà présentes, seed ignoré.")
    return
  }

  const payloads = buildSeedPayloads(seedUserId)
  const allInserts = []

  if (actionsCount === 0) {
    allInserts.push(
      client.from("fixed_charges").insert(payloads.fixedCharges),
      client.from("objectives").upsert(payloads.objectives, { onConflict: "year,type,scenario" }),
      client.from("monthly_objectives").upsert(payloads.monthlyObjectives, { onConflict: "year,month" }),
      client.from("action_items").insert(payloads.actionItems),
    )
  }

  if (salesCount === 0) {
    const posResult = await client.from("pos_imports").insert(payloads.imports)
    if (posResult.error && !isMissingTableError(posResult.error, "pos_imports")) {
      console.error("[seed-demo-data] pos_imports:", posResult.error.message)
    }
    allInserts.push(
      client.from("daily_sales").upsert(payloads.dailySales, { onConflict: "date" }),
      client.from("expenses").insert(payloads.expenses),
    )
  }

  if (allInserts.length === 0) return

  const results = await Promise.all(allInserts)
  const failed = results.filter((result) => result.error)
  failed.forEach((result) => console.error("[seed-demo-data] seed partiel:", result.error.message))

  if (failed.length > 0) {
    process.exitCode = 1
    return
  }

  console.log("Seed de démonstration terminé.")
}

await seedDemoData(supabase, userId)
