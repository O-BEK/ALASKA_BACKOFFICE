import "server-only"

import { eachDayOfInterval, endOfWeek, format, startOfWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { BREAKEVEN, CAISSE_RESERVE, calcBreakeven, calcBreakevenPct, calcMarginRate, calcNetMargin } from "@/lib/calculations"
import type { DailyEntry, MonthlyKPIs } from "@/lib/types"
import type { DailySaleRecord, ExpenseRecord, PilotDb } from "@/lib/server/pilot-store"

function liveBreakeven(db: PilotDb): number {
  const total = db.fixed_charges
    .filter((c) => c.is_active)
    .reduce((sum, c) => sum + c.amount, 0)
  return total > 0 ? calcBreakeven(total) : BREAKEVEN
}

function monthEntries(db: PilotDb, month: string) {
  return db.daily_sales.filter((item) => item.date.startsWith(month))
}

function monthExpenses(db: PilotDb, month: string) {
  return db.expenses.filter((item) => item.date.startsWith(month))
}

function saleByDate(sales: DailySaleRecord[]) {
  return sales.reduce<Record<string, DailySaleRecord>>((acc, sale) => {
    acc[sale.date] = sale
    return acc
  }, {})
}

function expensesByDate(expenses: ExpenseRecord[]) {
  return expenses.reduce<Record<string, ExpenseRecord[]>>((acc, expense) => {
    if (!acc[expense.date]) acc[expense.date] = []
    acc[expense.date].push(expense)
    return acc
  }, {})
}

export function buildMonthlyKpis(db: PilotDb, month: string): MonthlyKPIs {
  const sales = monthEntries(db, month)
  const expenses = monthExpenses(db, month)
  const ca_caisse = sales.reduce((sum, item) => sum + item.ca_caisse, 0)
  const ca_b2b = sales.reduce((sum, item) => sum + item.ca_b2b, 0)
  const ca_soir = sales.reduce((sum, item) => sum + item.ca_soir, 0)
  const total_expenses = expenses.reduce((sum, item) => sum + item.amount, 0)
  const ca_total = ca_caisse + ca_b2b
  const days_count = sales.length
  const marge_nette = calcNetMargin(ca_caisse, total_expenses)
  const taux_marge = calcMarginRate(marge_nette, ca_caisse)
  const pct_soir = ca_caisse > 0 ? (ca_soir / ca_caisse) * 100 : 0
  const breakeven = liveBreakeven(db)
  const pct_breakeven = calcBreakevenPct(ca_caisse, breakeven)

  return {
    month,
    ca_caisse,
    ca_b2b,
    ca_total,
    ca_soir,
    pct_soir,
    total_expenses,
    marge_nette,
    taux_marge,
    breakeven,
    pct_breakeven,
    days_count,
    ca_per_day: days_count > 0 ? ca_caisse / days_count : 0,
  }
}

export function buildDashboardData(db: PilotDb, month: string) {
  const kpis = buildMonthlyKpis(db, month)
  const [year, rawMonth] = month.split("-").map(Number)
  const previousMonth = rawMonth === 1 ? `${year - 1}-12` : `${year}-${String(rawMonth - 1).padStart(2, "0")}`
  const previous = buildMonthlyKpis(db, previousMonth)
  const delta_ca = previous.ca_caisse > 0 ? ((kpis.ca_caisse - previous.ca_caisse) / previous.ca_caisse) * 100 : 0

  const breakeven = liveBreakeven(db)
  const last12 = Array.from({ length: 12 }, (_, index) => {
    const current = new Date(year, rawMonth - 1 - (11 - index), 1)
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`
    const monthly = buildMonthlyKpis(db, key)
    return {
      month: key,
      ca_caisse: monthly.ca_caisse,
      ca_b2b: monthly.ca_b2b,
      breakeven,
    }
  })

  return { kpis, delta_ca, last12 }
}

export function buildWeekData(db: PilotDb, weekStart: Date) {
  const start = startOfWeek(weekStart, { weekStartsOn: 1 })
  const end = endOfWeek(weekStart, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start, end })
  const sales = saleByDate(
    db.daily_sales.filter((item) => item.date >= format(start, "yyyy-MM-dd") && item.date <= format(end, "yyyy-MM-dd"))
  )
  const expenses = expensesByDate(
    db.expenses.filter((item) => item.date >= format(start, "yyyy-MM-dd") && item.date <= format(end, "yyyy-MM-dd"))
  )

  const rows = days.map((day) => {
    const date = format(day, "yyyy-MM-dd")
    const sale = sales[date]
    const dayExpenses = expenses[date] || []
    const totalExpenses = dayExpenses.reduce((sum, item) => sum + item.amount, 0)

    const entry: DailyEntry | null = sale
      ? {
          date,
          ca_caisse: sale.ca_caisse,
          ca_b2b: sale.ca_b2b,
          ca_soir: sale.ca_soir,
          pct_soir: sale.pct_soir,
          tickets_count: sale.tickets_count,
          mouvement_caisse: sale.mouvement_caisse,
          notes: sale.notes,
          source: sale.source,
          expenses: dayExpenses.map((item) => ({
            id: item.id,
            category: item.category,
            label: item.label,
            amount: item.amount,
            notes: item.notes || undefined,
          })),
        }
      : null

    return {
      date,
      label: format(day, "EEE dd/MM", { locale: fr }),
      entry,
      totalExpenses,
      status: !entry && dayExpenses.length === 0 ? "empty" : (entry?.ca_caisse ?? 0) > 0 && totalExpenses > 0 ? "full" : "partial",
    }
  })

  const totalCA = rows.reduce((sum, row) => sum + (row.entry?.ca_caisse ?? 0), 0)
  const totalDep = rows.reduce((sum, row) => sum + row.totalExpenses, 0)
  const marge = calcNetMargin(totalCA, totalDep)
  const weeklyBreakeven = liveBreakeven(db) / 4.33
  const pctBreakeven = weeklyBreakeven > 0 ? (totalCA / weeklyBreakeven) * 100 : 0

  const byLabel: Record<string, number> = {}
  rows.forEach((row) => {
    row.entry?.expenses.forEach((expense) => {
      byLabel[expense.label] = (byLabel[expense.label] || 0) + expense.amount
    })
  })
  const expensesByLabel = Object.entries(byLabel)
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount)

  return { days: rows, totalCA, totalDep, marge, weeklyBreakeven, pctBreakeven, expensesByLabel }
}

export function buildWeekEntries(db: PilotDb, weekStart: Date) {
  const week = buildWeekData(db, weekStart)
  return week.days.reduce<Record<string, DailyEntry>>((acc, day) => {
    acc[day.date] = day.entry || {
      date: day.date,
      ca_caisse: 0,
      ca_b2b: 0,
      ca_soir: 0,
      pct_soir: 0,
      tickets_count: 0,
      mouvement_caisse: 0,
      notes: "",
      source: "manual",
      expenses: [],
    }
    return acc
  }, {})
}

export function monthExpensesByLabel(db: PilotDb, month: string) {
  const labelMap: Record<string, number> = {}
  db.expenses
    .filter((item) => item.date.startsWith(month))
    .forEach((item) => {
      labelMap[item.label] = (labelMap[item.label] || 0) + item.amount
    })

  return Object.entries(labelMap)
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount)
}

export function monthReporting(db: PilotDb, month: string) {
  const monthly = buildMonthlyKpis(db, month)
  const [year, rawMonth] = month.split("-").map(Number)
  const previousMonth = rawMonth === 1 ? `${year - 1}-12` : `${year}-${String(rawMonth - 1).padStart(2, "0")}`
  const previous = buildMonthlyKpis(db, previousMonth)

  return {
    monthCA: monthly.ca_caisse,
    prevCA: previous.ca_caisse,
    monthExp: monthly.total_expenses,
    expByLabel: monthExpensesByLabel(db, month),
    byCategory: ["MP", "RH", "CHARGES", "AUTRE"].map((category) => ({
      name: category,
      value: db.expenses
        .filter((item) => item.date.startsWith(month) && item.category === category)
        .reduce((sum, item) => sum + item.amount, 0),
    })),
    pctSeuil: monthly.pct_breakeven,
    soldeMois: monthly.ca_caisse - monthly.total_expenses,
  }
}

export function buildLastSixMonths(db: PilotDb, month: string) {
  const [year, rawMonth] = month.split("-").map(Number)
  return Array.from({ length: 6 }, (_, index) => {
    const current = new Date(year, rawMonth - 1 - (5 - index), 1)
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`
    const monthly = buildMonthlyKpis(db, key)
    const target = db.monthly_objectives.find(
      (item) => item.year === current.getFullYear() && item.month === current.getMonth() + 1
    )
    return {
      month: format(current, "MMM", { locale: fr }),
      ca: monthly.ca_caisse,
      objectif: target?.target_ca ?? null,
    }
  })
}

export function buildMonthlyExportRows(db: PilotDb, month: string) {
  const sales = saleByDate(db.daily_sales.filter((item) => item.date.startsWith(month)))
  const expenses = expensesByDate(db.expenses.filter((item) => item.date.startsWith(month)))
  const dates = Array.from(new Set([...Object.keys(sales), ...Object.keys(expenses)])).sort()

  return dates.map((date) => {
    const dayExpenses = expenses[date] || []
    const totals = dayExpenses.reduce(
      (acc, expense) => {
        acc.total += expense.amount
        acc[expense.category] += expense.amount
        return acc
      },
      { total: 0, MP: 0, RH: 0, CHARGES: 0, AUTRE: 0 }
    )

    return {
      date,
      ca_caisse: sales[date]?.ca_caisse ?? 0,
      total_expenses: totals.total,
      MP: totals.MP,
      RH: totals.RH,
      CHARGES: totals.CHARGES,
      AUTRE: totals.AUTRE,
    }
  })
}

export function buildCaisseBalance(db: PilotDb, sinceOverride?: string): { balance: number; toDeposit: number; since: string } {
  // Scope to current week (Monday → today) — historical CSV data predates cash management setup
  const now = new Date()
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1 // Monday = 0
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek)
  const since = sinceOverride ?? monday.toISOString().slice(0, 10)
  const totalCA = db.daily_sales.filter((r) => r.date >= since).reduce((sum, r) => sum + r.ca_caisse, 0)
  const totalMvt = db.daily_sales.filter((r) => r.date >= since).reduce((sum, r) => sum + r.mouvement_caisse, 0)
  const totalExp = db.expenses.filter((e) => e.date >= since).reduce((sum, e) => sum + e.amount, 0)
  const balance = totalCA - totalMvt - totalExp
  return { balance, toDeposit: Math.max(0, balance - CAISSE_RESERVE), since }
}
