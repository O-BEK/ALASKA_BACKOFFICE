import "server-only"

import { eachDayOfInterval, eachWeekOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { BREAKEVEN, CAISSE_RESERVE, calcBreakeven, calcBreakevenPct, calcMarginRate, calcNetMargin, getWeeklyBreakeven } from "@/lib/calculations"
import { getCashEnvelope, getCashMovementsReference, getCashSalesReference } from "@/lib/cash"
import type { DailyEntry, MonthlyKPIs } from "@/lib/types"
import type { DailySaleRecord, ExpenseRecord, PilotDb } from "@/lib/server/db-types"

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

function monthBounds(month: string) {
  const [year, rawMonth] = month.split("-").map(Number)
  const monthStart = startOfMonth(new Date(year, rawMonth - 1, 1))
  const monthEnd = endOfMonth(monthStart)
  return { year, rawMonth, monthStart, monthEnd }
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`
}

function isChargeActiveForMonth(charge: PilotDb["fixed_charges"][number], month: string) {
  const { monthStart, monthEnd } = monthBounds(month)
  const monthStartStr = format(monthStart, "yyyy-MM-dd")
  const monthEndStr = format(monthEnd, "yyyy-MM-dd")
  const hasOverlap = charge.start_date <= monthEndStr && (!charge.end_date || charge.end_date >= monthStartStr)
  return hasOverlap && (charge.is_active || !!charge.end_date)
}

function monthExpenseTotalsByLabel(db: PilotDb, month: string) {
  return monthExpenses(db, month).reduce<Record<string, number>>((acc, item) => {
    acc[item.label] = (acc[item.label] || 0) + item.amount
    return acc
  }, {})
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

function totalExpensesForDay(expenses: ExpenseRecord[]) {
  return expenses.reduce((sum, item) => sum + item.amount, 0)
}

function buildCashMonthSummary(db: PilotDb, month: string) {
  const sales = monthEntries(db, month)
  const expenses = monthExpenses(db, month)
  const cash_sales = sales.reduce((sum, item) => sum + getCashSalesReference(item), 0)
  const cash_movements = sales.reduce((sum, item) => sum + getCashMovementsReference(item), 0)
  const cash_purchases = expenses.reduce((sum, item) => sum + item.amount, 0)
  const ca_global = sales.reduce((sum, item) => sum + item.ca_caisse + item.ca_b2b, 0)
  const anomaly_days = sales.filter((item) => item.cash_journal_anomaly).length

  return {
    month,
    cash_sales,
    cash_movements,
    cash_purchases,
    cash_envelope: cash_sales + cash_movements - cash_purchases,
    ca_global,
    anomaly_days,
    days_count: sales.length,
  }
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
  const marge_nette = calcNetMargin(ca_total, total_expenses)
  const taux_marge = calcMarginRate(marge_nette, ca_total)
  const pct_soir = ca_total > 0 ? (ca_soir / ca_total) * 100 : 0
  const breakeven = liveBreakeven(db)
  const pct_breakeven = calcBreakevenPct(ca_total, breakeven)

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
    ca_per_day: days_count > 0 ? ca_total / days_count : 0,
  }
}

export function buildDashboardData(db: PilotDb, month: string) {
  const kpis = buildMonthlyKpis(db, month)
  const cashMonth = buildCashMonthSummary(db, month)
  const { year, rawMonth, monthStart, monthEnd } = monthBounds(month)
  const previousMonth = rawMonth === 1 ? `${year - 1}-12` : `${year}-${String(rawMonth - 1).padStart(2, "0")}`
  const previous = buildMonthlyKpis(db, previousMonth)
  const delta_ca = previous.ca_total > 0 ? ((kpis.ca_total - previous.ca_total) / previous.ca_total) * 100 : 0

  const breakeven = liveBreakeven(db)
  const monthlyObjective =
    db.monthly_objectives.find((item) => item.year === year && item.month === rawMonth) || null
  const last12 = Array.from({ length: 12 }, (_, index) => {
    const current = new Date(year, rawMonth - 1 - (11 - index), 1)
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`
    const monthly = buildMonthlyKpis(db, key)
    return {
      month: key,
      ca_caisse: monthly.ca_caisse,
      ca_b2b: monthly.ca_b2b,
      ca_total: monthly.ca_total,
      breakeven,
    }
  })

  const daysInMonth = monthEnd.getDate()
  const target = monthlyObjective?.target_ca ?? null
  const objectivePct = target && target > 0 ? (kpis.ca_total / target) * 100 : 0
  const todayDate = new Date().toISOString().slice(0, 10)
  const todaySale = db.daily_sales.find((item) => item.date === todayDate) || null
  const todayExpenses = db.expenses.filter((item) => item.date === todayDate)
  const todayNotes = Array.from(
    new Set(
      [todaySale?.notes || "", ...todayExpenses.map((item) => item.notes || "")]
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
  const todayHasSales = !!todaySale && (todaySale.ca_caisse > 0 || todaySale.ca_b2b > 0)
  const todayHasExpenses = todayExpenses.some((item) => item.amount > 0)
  const weeklyMonth = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 }).map((weekStart, index) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
    const rangeEnd = weekEnd > monthEnd ? monthEnd : weekEnd
    const rangeStartKey = format(weekStart, "yyyy-MM-dd")
    const rangeEndKey = format(rangeEnd, "yyyy-MM-dd")
    const sales = db.daily_sales.filter((item) => item.date >= rangeStartKey && item.date <= rangeEndKey)
    const ca_total = sales.reduce((sum, item) => sum + item.ca_caisse + item.ca_b2b, 0)
    const days_count = sales.length

    return {
      label: `S${index + 1}`,
      range: `${format(weekStart, "dd/MM")} – ${format(rangeEnd, "dd/MM")}`,
      ca_total,
      days_count,
      ca_per_day: days_count > 0 ? ca_total / days_count : 0,
      breakeven: getWeeklyBreakeven(),
    }
  })

  return {
    kpis,
    delta_ca,
    last12,
    hasMonthData: kpis.ca_total > 0 || kpis.total_expenses > 0,
    monthObjective: {
      target,
      real: kpis.ca_total,
      pct: objectivePct,
      remaining: target ? Math.max(target - kpis.ca_total, 0) : 0,
      daily_target: target ? target / daysInMonth : 0,
      note: monthlyObjective?.notes || "",
    },
    today: {
      date: todayDate,
      ca_caisse: todaySale?.ca_caisse ?? 0,
      ca_b2b: todaySale?.ca_b2b ?? 0,
      ca_total: (todaySale?.ca_caisse ?? 0) + (todaySale?.ca_b2b ?? 0),
      total_expenses: todayExpenses.reduce((sum, item) => sum + item.amount, 0),
      notes: todayNotes,
      status: todayHasSales && todayHasExpenses ? "complete" : todayHasSales || todayHasExpenses ? "partial" : "missing",
    },
    cashMonth,
    weeklyMonth,
  }
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
    const totalExpenses = totalExpensesForDay(dayExpenses)

    const entry: DailyEntry | null = sale
      ? {
          date,
          ca_caisse: sale.ca_caisse,
          ca_b2b: sale.ca_b2b,
          ca_soir: sale.ca_soir,
          pct_soir: sale.pct_soir,
          tickets_count: sale.tickets_count,
          mouvement_caisse: sale.mouvement_caisse,
          cash_sales_journal: sale.cash_sales_journal,
          cash_movements_journal: sale.cash_movements_journal,
          cash_opening_fund: sale.cash_opening_fund,
          cash_closing_fund: sale.cash_closing_fund,
          cash_journal_sessions: sale.cash_journal_sessions,
          cash_journal_anomaly: sale.cash_journal_anomaly,
          cash_journal_import_id: sale.cash_journal_import_id,
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
      status: !entry && dayExpenses.length === 0 ? "empty" : getCashSalesReference(entry) > 0 && totalExpenses > 0 ? "full" : "partial",
    }
  })

  const totalCA = rows.reduce((sum, row) => sum + (row.entry ? row.entry.ca_caisse + row.entry.ca_b2b : 0), 0)
  const totalDep = rows.reduce((sum, row) => sum + row.totalExpenses, 0)
  const totalCashSales = rows.reduce((sum, row) => sum + getCashSalesReference(row.entry), 0)
  const totalCashMovements = rows.reduce((sum, row) => sum + getCashMovementsReference(row.entry), 0)
  const totalCashEnvelope = rows.reduce((sum, row) => sum + getCashEnvelope(row.entry, row.totalExpenses), 0)
  const cashAnomalyDays = rows.reduce((sum, row) => sum + (row.entry?.cash_journal_anomaly ? 1 : 0), 0)
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

  return {
    days: rows,
    totalCA,
    totalDep,
    marge,
    totalCashSales,
    totalCashMovements,
    totalCashEnvelope,
    cashAnomalyDays,
    weeklyBreakeven,
    pctBreakeven,
    expensesByLabel,
  }
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
      cash_sales_journal: null,
      cash_movements_journal: null,
      cash_opening_fund: null,
      cash_closing_fund: null,
      cash_journal_sessions: 0,
      cash_journal_anomaly: false,
      cash_journal_import_id: null,
      notes: "",
      source: "manual",
      expenses: [],
    }
    return acc
  }, {})
}

export function monthExpensesByLabel(db: PilotDb, month: string) {
  const labelMap = monthExpenseTotalsByLabel(db, month)

  return Object.entries(labelMap)
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount)
}

export function monthReporting(db: PilotDb, month: string) {
  const monthly = buildMonthlyKpis(db, month)
  const { year, rawMonth } = monthBounds(month)
  const previousMonth = rawMonth === 1 ? `${year - 1}-12` : `${year}-${String(rawMonth - 1).padStart(2, "0")}`
  const previous = buildMonthlyKpis(db, previousMonth)
  const previousYear = buildMonthlyKpis(db, `${year - 1}-${String(rawMonth).padStart(2, "0")}`)
  const expenseByLabel = monthExpensesByLabel(db, month)
  const expenseLabelTotals = monthExpenseTotalsByLabel(db, month)
  const activeCharges = db.fixed_charges.filter((charge) => isChargeActiveForMonth(charge, month))
  const notes = db.daily_sales
    .filter((item) => item.date.startsWith(month) && item.notes.trim())
    .map((item) => ({ date: item.date, note: item.notes.trim() }))
  const comparison = buildYearComparisonRows(db, year)
  const chargeReconciliation = activeCharges
    .map((charge) => {
      const actual = expenseLabelTotals[charge.name] || 0
      return {
        name: charge.name,
        category: charge.category,
        payment_day: charge.payment_day,
        theoretical: charge.amount,
        actual,
        delta: actual - charge.amount,
      }
    })
    .sort((a, b) => b.theoretical - a.theoretical || b.actual - a.actual)
  const staffPayments = chargeReconciliation.filter((item) => activeCharges.find((charge) => charge.name === item.name)?.is_staff)

  return {
    summary: {
      ca_caisse: monthly.ca_caisse,
      ca_b2b: monthly.ca_b2b,
      ca_total: monthly.ca_total,
      prev_total: previous.ca_total,
      prev_year_total: previousYear.ca_total,
      prev_pct: previous.ca_total > 0 ? ((monthly.ca_total - previous.ca_total) / previous.ca_total) * 100 : 0,
      prev_year_pct: previousYear.ca_total > 0 ? ((monthly.ca_total - previousYear.ca_total) / previousYear.ca_total) * 100 : 0,
      ca_per_day: monthly.ca_per_day,
      days_count: monthly.days_count,
      total_expenses: monthly.total_expenses,
      marge_nette: monthly.marge_nette,
      taux_marge: monthly.taux_marge,
      breakeven: monthly.breakeven,
      pct_seuil: monthly.pct_breakeven,
      solde_mois: monthly.ca_total - monthly.total_expenses,
      ca_soir: monthly.ca_soir,
      pct_soir: monthly.pct_soir,
    },
    expByLabel: expenseByLabel,
    byCategory: ["MP", "RH", "CHARGES", "AUTRE"].map((category) => ({
      name: category,
      value: db.expenses
        .filter((item) => item.date.startsWith(month) && item.category === category)
        .reduce((sum, item) => sum + item.amount, 0),
    })),
    notes,
    staffPayments,
    chargeReconciliation,
    comparison,
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
      ca: monthly.ca_total,
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
      ca_b2b: sales[date]?.ca_b2b ?? 0,
      ca_total: (sales[date]?.ca_caisse ?? 0) + (sales[date]?.ca_b2b ?? 0),
      ca_soir: sales[date]?.ca_soir ?? 0,
      pct_soir: sales[date]?.pct_soir ?? 0,
      source: sales[date]?.source ?? "manual",
      notes: sales[date]?.notes ?? "",
      total_expenses: totals.total,
      MP: totals.MP,
      RH: totals.RH,
      CHARGES: totals.CHARGES,
      AUTRE: totals.AUTRE,
    }
  })
}

export function buildExpenseExportRows(db: PilotDb, month: string) {
  return monthExpenses(db, month)
    .sort((a, b) => a.date.localeCompare(b.date) || a.category.localeCompare(b.category) || a.label.localeCompare(b.label))
    .map((expense) => ({
      date: expense.date,
      day: format(new Date(expense.date), "EEE", { locale: fr }),
      category: expense.category,
      label: expense.label,
      amount: expense.amount,
      notes: expense.notes || "",
    }))
}

export function buildYearComparisonRows(db: PilotDb, year: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const currentMonth = monthKey(year, index + 1)
    const previousMonth = monthKey(year - 1, index + 1)
    const current = buildMonthlyKpis(db, currentMonth).ca_total
    const previous = buildMonthlyKpis(db, previousMonth).ca_total

    return {
      month: format(new Date(year, index, 1), "MMM", { locale: fr }),
      current,
      previous,
      delta_pct: previous > 0 ? ((current - previous) / previous) * 100 : null,
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
  const scopedSales = db.daily_sales.filter((r) => r.date >= since)
  const totalCA = scopedSales.reduce((sum, r) => sum + getCashSalesReference(r), 0)
  const totalMvt = scopedSales.reduce((sum, r) => sum + getCashMovementsReference(r), 0)
  const totalExp = db.expenses.filter((e) => e.date >= since).reduce((sum, e) => sum + e.amount, 0)
  const balance = totalCA + totalMvt - totalExp
  return { balance, toDeposit: Math.max(0, balance - CAISSE_RESERVE), since }
}
