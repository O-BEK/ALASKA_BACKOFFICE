import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { buildCaisseBalance, buildCashMonthSummary, buildDashboardData, buildFinancialConsolidation, buildLast4WeeksComparison, buildWeekData, monthReporting } from "../lib/server/analytics"
import type { PilotDb, ExpenseRecord } from "../lib/server/db-types"
import type { FixedCharge } from "../lib/types"

function makeDb(overrides: Partial<PilotDb> = {}): PilotDb {
  return {
    users: [],
    daily_sales: [],
    expenses: [],
    fixed_charges: [],
    objectives: [],
    monthly_objectives: [],
    action_items: [],
    import_history: [],
    ...overrides,
  } as PilotDb
}

function makeSale(overrides: Partial<PilotDb["daily_sales"][number]> = {}): PilotDb["daily_sales"][number] {
  return {
    id: "sale",
    date: "2026-01-01",
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
    import_id: null,
    created_by: null,
    updated_at: "",
    ...overrides,
  }
}

function makeBankSupabase(rows: any[]) {
  const chain = {
    select: () => chain,
    gte: () => chain,
    lte: () => chain,
    order: () => ({ data: rows, error: null }),
  }
  return { from: () => chain }
}

describe("buildCaisseBalance", () => {
  it("computes balance and toDeposit from all sales and expenses", () => {
    const db = makeDb({
      daily_sales: [
        makeSale({ id: "s1", date: "2026-01-01", ca_caisse: 5000, tickets_count: 30 }),
        makeSale({ id: "s2", date: "2026-01-02", ca_caisse: 3000, tickets_count: 20 }),
      ],
      expenses: [
        { id: "e1", date: "2026-01-01", category: "MP", label: "Poissonnier", amount: 2000, notes: "", created_by: null, updated_at: "" },
        { id: "e2", date: "2026-01-02", category: "CHARGES", label: "Virement banque", amount: 1500, notes: "", created_by: null, updated_at: "" },
      ],
    })
    // balance = (5000 + 3000) - (2000 + 1500) = 4500
    // toDeposit = max(0, 4500 - 1000) = 3500
    const result = buildCaisseBalance(db, "2026-01")
    expect(result.balance).toBe(4500)
    expect(result.toDeposit).toBe(3500)
  })

  it("returns toDeposit 0 when balance is below 1000 MAD reserve", () => {
    const db = makeDb({
      daily_sales: [
        makeSale({ id: "s1", date: "2026-01-01", ca_caisse: 800, tickets_count: 5 }),
      ],
    })
    const result = buildCaisseBalance(db, "2026-01")
    expect(result.balance).toBe(800)
    expect(result.toDeposit).toBe(0)
  })

  it("returns zero balance and toDeposit when no data", () => {
    const result = buildCaisseBalance(makeDb())
    expect(result.balance).toBe(0)
    expect(result.toDeposit).toBe(0)
  })
})

describe("buildDashboardData", () => {
  it("returns month objective, today status, and weekly aggregation", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-12T10:00:00.000Z"))

    try {
      const db = makeDb({
        daily_sales: [
          makeSale({ id: "s1", date: "2026-04-12", ca_caisse: 1500, ca_b2b: 500, ca_soir: 400, pct_soir: 20, tickets_count: 18, notes: "Service du soir solide" }),
          makeSale({ id: "s2", date: "2026-04-15", ca_caisse: 2000, ca_soir: 200, pct_soir: 10, tickets_count: 21, source: "csv_import" }),
        ],
        expenses: [
          { id: "e1", date: "2026-04-12", category: "MP", label: "Poisson", amount: 300, notes: "Réassort", created_by: null, updated_at: "" },
        ],
        fixed_charges: [
          { id: "c1", name: "Loyer", category: "IMMOBILIER", amount: 34000, type: "fixed", payment_day: 5, is_staff: false, is_active: true, start_date: "2026-01-01", end_date: null },
        ],
        monthly_objectives: [
          { year: 2026, month: 4, target_ca: 30000, notes: "Tenir le rythme avant l'été" },
        ],
      })

      const result = buildDashboardData(db, "2026-04")

      expect(result.hasMonthData).toBe(true)
      expect(result.monthObjective).toMatchObject({
        target: 30000,
        real: 4000,
        remaining: 26000,
        daily_target: 1000,
        note: "Tenir le rythme avant l'été",
      })
      expect(result.today).toMatchObject({
        date: "2026-04-12",
        ca_total: 2000,
        total_expenses: 300,
        status: "complete",
      })
      expect(result.today.notes).toEqual(["Service du soir solide", "Réassort"])
      expect(result.weeklyMonth.reduce((sum, week) => sum + week.ca_total, 0)).toBe(4000)
      expect(result.weeklyMonth.filter((week) => week.ca_total === 2000 && week.days_count === 1 && week.ca_per_day === 2000)).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("buildDashboardData kpis_secondary", () => {
  it("buildDashboardData inclut kpis_secondary avec avg_ticket, coverage_pct, mix_cash_pct", () => {
    // jour 1 : ca_caisse: 2000, ca_b2b: 500, tickets_count: 20
    // jour 2 : ca_caisse: 1800, ca_b2b: 400, tickets_count: 18
    // avg_ticket = (2000+500+1800+400) / (20+18) = 4700/38 ≈ 123.68
    // coverage_pct = 2/30 * 100 ≈ 6.67
    // mix_cash_pct = (2000+1800) / (2000+500+1800+400) * 100 = 3800/4700 * 100 ≈ 80.85
    const db = makeDb({
      daily_sales: [
        makeSale({ id: "s1", date: "2026-04-01", ca_caisse: 2000, ca_b2b: 500, tickets_count: 20 }),
        makeSale({ id: "s2", date: "2026-04-02", ca_caisse: 1800, ca_b2b: 400, tickets_count: 18 }),
      ],
    })
    const result = buildDashboardData(db, "2026-04")
    expect(result.kpis_secondary.avg_ticket).toBeCloseTo(123.68, 0)
    expect(result.kpis_secondary.coverage_pct).toBeCloseTo(6.67, 0)
    expect(result.kpis_secondary.mix_cash_pct).toBeCloseTo(80.85, 0)
  })
})

describe("buildDashboardData delta fields", () => {
  it("buildDashboardData inclut delta_expenses et delta_marge", () => {
    const db = makeDb({
      daily_sales: [
        makeSale({ id: "s1", date: "2026-04-01", ca_caisse: 3000, ca_b2b: 1000 }),
        makeSale({ id: "s2", date: "2026-03-01", ca_caisse: 2500, ca_b2b: 500 }),
      ],
      expenses: [
        { id: "e1", date: "2026-04-01", category: "MP", label: "Poisson", amount: 800, notes: "", created_by: null, updated_at: "" },
        { id: "e2", date: "2026-03-01", category: "MP", label: "Poisson", amount: 1000, notes: "", created_by: null, updated_at: "" },
      ],
    })

    const result = buildDashboardData(db, "2026-04")

    // dépenses avril (800) < dépenses mars (1000) → delta_expenses < 0
    expect(result.delta_expenses).toBeLessThan(0)
    expect(typeof result.delta_marge).toBe("number")
  })
})

describe("monthReporting", () => {
  it("keeps dashboard, weekly view, and reporting totals coherent for one fixed month", () => {
    const sales = Array.from({ length: 10 }, (_, index) => {
      const day = String(index + 2).padStart(2, "0")
      return makeSale({
        id: `s${index}`,
        date: `2026-03-${day}`,
        ca_caisse: 1000 + index * 10,
        ca_b2b: 500,
        ca_soir: 250,
        tickets_count: 20 + index,
      })
    })
    const expenses = sales.map((sale, index) => ({
      id: `e${index}`,
      date: sale.date,
      category: index % 2 === 0 ? "MP" as const : "RH" as const,
      label: index % 2 === 0 ? "Poisson" : "Equipe",
      amount: 200 + index,
      notes: "",
      created_by: null,
      updated_at: "",
    }))
    const db = makeDb({ daily_sales: sales, expenses })
    const expectedCaTotal = sales.reduce((sum, sale) => sum + sale.ca_caisse + sale.ca_b2b, 0)
    const expectedExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)

    const dashboard = buildDashboardData(db, "2026-03")
    const reporting = monthReporting(db, "2026-03")
    const weekTotals = [
      buildWeekData(db, new Date(2026, 2, 2)),
      buildWeekData(db, new Date(2026, 2, 9)),
    ].reduce(
      (totals, week) => ({
        ca: totals.ca + week.totalCA,
        expenses: totals.expenses + week.totalDep,
      }),
      { ca: 0, expenses: 0 }
    )

    expect(dashboard.kpis.ca_total).toBe(expectedCaTotal)
    expect(reporting.summary.ca_total).toBe(expectedCaTotal)
    expect(weekTotals.ca).toBe(expectedCaTotal)
    expect(dashboard.kpis.total_expenses).toBe(expectedExpenses)
    expect(reporting.summary.total_expenses).toBe(expectedExpenses)
    expect(weekTotals.expenses).toBe(expectedExpenses)
  })

  it("builds summary, comparison, and charge reconciliation for the selected month", () => {
    const db = makeDb({
      daily_sales: [
        makeSale({ id: "s1", date: "2026-03-05", ca_caisse: 10000, ca_b2b: 2000, ca_soir: 2500, pct_soir: 20.8, tickets_count: 40, notes: "Ramadan démarre bien" }),
        makeSale({ id: "s2", date: "2026-03-06", ca_caisse: 8000, ca_b2b: 1000, ca_soir: 1500, pct_soir: 16.7, tickets_count: 35, source: "csv_import" }),
        makeSale({ id: "s3", date: "2026-02-05", ca_caisse: 9000, ca_b2b: 1000, ca_soir: 1200, pct_soir: 12, tickets_count: 36 }),
        makeSale({ id: "s4", date: "2025-03-05", ca_caisse: 6000, ca_b2b: 1000, ca_soir: 500, pct_soir: 7.1, tickets_count: 25 }),
      ],
      expenses: [
        { id: "e1", date: "2026-03-05", category: "CHARGES", label: "Loyer", amount: 34000, notes: "", created_by: null, updated_at: "" },
        { id: "e2", date: "2026-03-06", category: "RH", label: "Ramzi", amount: 4500, notes: "", created_by: null, updated_at: "" },
        { id: "e3", date: "2026-03-06", category: "MP", label: "Poisson", amount: 2800, notes: "", created_by: null, updated_at: "" },
      ],
      fixed_charges: [
        { id: "c1", name: "Loyer", category: "IMMOBILIER", amount: 34000, type: "fixed", payment_day: 5, is_staff: false, is_active: true, start_date: "2026-01-01", end_date: null },
        { id: "c2", name: "Ramzi", category: "PERSONNEL", amount: 6000, type: "fixed", payment_day: 30, is_staff: true, is_active: true, start_date: "2026-01-01", end_date: null },
      ],
      monthly_objectives: [
        { year: 2026, month: 4, target_ca: 22000, notes: "Terrasse" },
      ],
    })

    const result = monthReporting(db, "2026-03")

    expect(result.summary).toMatchObject({
      ca_caisse: 18000,
      ca_b2b: 3000,
      ca_total: 21000,
      prev_total: 10000,
      prev_year_total: 7000,
      total_expenses: 41300,
      solde_mois: -20300,
    })
    expect(result.notes).toEqual([{ date: "2026-03-05", note: "Ramadan démarre bien" }])
    expect(result.chargeReconciliation).toEqual([
      { name: "Loyer", category: "IMMOBILIER", payment_day: 5, theoretical: 34000, actual: 34000, delta: 0 },
      { name: "Ramzi", category: "PERSONNEL", payment_day: 30, theoretical: 6000, actual: 4500, delta: -1500 },
    ])
    expect(result.staffPayments).toEqual([
      { name: "Ramzi", category: "PERSONNEL", payment_day: 30, theoretical: 6000, actual: 4500, delta: -1500 },
    ])
    expect(result.smartProjection.assumptions.alcool_uplift_pct).toBe(47)
    expect(result.smartProjection.annual[0].avec_alcool).toBeGreaterThan(result.smartProjection.annual[0].sans_alcool)
    expect(result.smartProjection.monthly.some((item) => item.alcool_active && item.delta > 0)).toBe(true)
    expect(result.comparison).toHaveLength(12)
    expect(result.comparison[2]).toMatchObject({
      current: 21000,
      previous: 7000,
      delta_pct: 200,
    })
  })
})

describe("buildDashboardData cashMonth split", () => {
  it("splits expenses into 4 breakdown fields", () => {
    const db = makeDb({
      daily_sales: [makeSale({ id: "s1", date: "2026-01-15", ca_caisse: 5000 })],
      expenses: [
        { id: "e1", date: "2026-01-15", category: "MP",      label: "Poissonnier",    amount: 1000, notes: "", created_by: null, updated_at: "" },
        { id: "e2", date: "2026-01-15", category: "AUTRE",   label: "Divers",          amount: 200,  notes: "", created_by: null, updated_at: "" },
        { id: "e3", date: "2026-01-15", category: "CHARGES", label: "Loyer",           amount: 800,  notes: "", created_by: null, updated_at: "" },
        { id: "e4", date: "2026-01-15", category: "CHARGES", label: "Virement banque", amount: 2000, notes: "", created_by: null, updated_at: "" },
        { id: "e5", date: "2026-01-15", category: "RH",      label: "Ramzi",           amount: 1500, notes: "", created_by: null, updated_at: "" },
      ],
    })
    const result = buildDashboardData(db, "2026-01")
    expect(result.cashMonth.cash_mp_divers).toBe(1200)  // MP 1000 + AUTRE 200
    expect(result.cashMonth.cash_charges).toBe(800)     // CHARGES hors "Virement banque"
    expect(result.cashMonth.cash_rh).toBe(1500)         // RH uniquement
    expect(result.cashMonth.cash_depot).toBe(2000)      // CHARGES label "Virement banque"
    expect(result.cashMonth.cash_purchases).toBe(5500)  // somme totale (backward compat)
    expect(result.cashMonth.cash_envelope).toBe(-500)   // 5000 - 5500
  })
})

function makeExpenseRecord(date: string, overrides: { category: "MP" | "RH" | "CHARGES" | "AUTRE"; amount: number; label?: string }): ExpenseRecord {
  return {
    id: Math.random().toString(),
    date,
    category: overrides.category,
    amount: overrides.amount,
    label: overrides.label ?? "test",
    notes: "",
    created_by: "test",
    updated_at: "",
  }
}

function makeFixedCharge(overrides: { amount: number; is_active: boolean; start_date: string; end_date: string | null }): FixedCharge {
  return {
    id: Math.random().toString(),
    name: "test charge",
    category: "DIVERS",
    amount: overrides.amount,
    type: "fixed",
    payment_day: null,
    is_staff: false,
    is_active: overrides.is_active,
    start_date: overrides.start_date,
    end_date: overrides.end_date,
  }
}

describe("buildCashMonthSummary — prime cost & résultat net", () => {
  it("calculates prime_cost_pct as (mp + rh) / ca * 100", () => {
    const db = makeDb({
      daily_sales: [makeSale({ id: "s1", date: "2026-05-10", ca_caisse: 8000, ca_b2b: 2000 })],
      expenses: [
        makeExpenseRecord("2026-05-10", { category: "MP", amount: 3000 }),
        makeExpenseRecord("2026-05-10", { category: "RH", amount: 2000 }),
      ],
      fixed_charges: [],
    })
    const result = buildCashMonthSummary(db, "2026-05")
    expect(result.prime_cost_pct).toBeCloseTo(50) // (3000+2000)/10000*100
  })

  it("returns prime_cost_pct = 0 when ca_global is 0", () => {
    const db = makeDb({
      daily_sales: [],
      expenses: [makeExpenseRecord("2026-05-10", { category: "MP", amount: 1000 })],
      fixed_charges: [],
    })
    const result = buildCashMonthSummary(db, "2026-05")
    expect(result.prime_cost_pct).toBe(0)
  })

  it("calculates resultat_net as ca - mp - rh - fixed_charges", () => {
    const db = makeDb({
      daily_sales: [makeSale({ id: "s1", date: "2026-05-10", ca_caisse: 10000, ca_b2b: 0 })],
      expenses: [
        makeExpenseRecord("2026-05-10", { category: "MP", amount: 3000 }),
        makeExpenseRecord("2026-05-10", { category: "RH", amount: 2000 }),
      ],
      fixed_charges: [makeFixedCharge({ amount: 1500, is_active: true, start_date: "2026-01-01", end_date: null })],
    })
    const result = buildCashMonthSummary(db, "2026-05")
    expect(result.resultat_net).toBe(3500) // 10000 - 3000 - 2000 - 1500
  })
})

describe("buildFinancialConsolidation", () => {
  it("ne double-compte pas le virement banque et calcule une perte réelle", async () => {
    const db = makeDb({
      daily_sales: [makeSale({ id: "s1", date: "2026-04-01", ca_caisse: 5000, ca_b2b: 1000 })],
      expenses: [
        { id: "e1", date: "2026-04-01", category: "MP", label: "Poisson cash", amount: 1500, notes: "", created_by: null, updated_at: "" },
        { id: "e2", date: "2026-04-01", category: "CHARGES", label: "Virement banque", amount: 2000, notes: "", created_by: null, updated_at: "" },
      ],
    })
    const bankRows = [
      { date: "2026-04-02", label: "Fournisseur", debit: 7000, credit: 0, balance: 0, classification: "supplier_payment", review_status: "confirmed" },
      { date: "2026-04-03", label: "Versement especes", debit: 0, credit: 2000, balance: 0, classification: "cash_deposit", review_status: "confirmed" },
      { date: "2026-04-04", label: "Apport Othman", debit: 0, credit: 3000, balance: 0, classification: "owner_injection", review_status: "suggested" },
    ]

    const result = await buildFinancialConsolidation(db, makeBankSupabase(bankRows), "2026-04")

    expect(result.ca_pos).toBe(6000)
    expect(result.cash_expenses).toBe(1500)
    expect(result.cash_deposits).toBe(2000)
    expect(result.bank_cash_deposits).toBe(2000)
    expect(result.bank_expenses).toBe(7000)
    expect(result.real_result).toBe(-2500)
    expect(result.owner_injections).toBe(3000)
    expect(result.status).toBe("loss")
  })
})

describe("buildLast4WeeksComparison", () => {
  it("returns exactly 4 items", () => {
    const db = makeDb({})
    const result = buildLast4WeeksComparison(db, new Date("2026-05-11"))
    expect(result).toHaveLength(4)
  })

  it("each item has label, current, and previous fields", () => {
    const db = makeDb({})
    const result = buildLast4WeeksComparison(db, new Date("2026-05-11"))
    result.forEach((item) => {
      expect(item).toHaveProperty("label")
      expect(item).toHaveProperty("current")
      expect(item).toHaveProperty("previous")
      expect(item.label).toMatch(/^S\d+$/)
    })
  })

  it("aggregates ca_total for days within the week range", () => {
    // Week of 2026-05-11 is ISO week 20 (Mon 2026-05-11 to Sun 2026-05-17)
    // 52 weeks back from 2026-05-11 = 2025-05-12, week of 2025-05-12 is Mon 2025-05-12 to Sun 2025-05-18
    const db = makeDb({
      daily_sales: [
        makeSale({ date: "2026-05-11", ca_caisse: 5000, ca_b2b: 1000 }), // current week
        makeSale({ id: "prev", date: "2025-05-12", ca_caisse: 3000, ca_b2b: 500 }),  // previous year equivalent
      ],
    })
    const result = buildLast4WeeksComparison(db, new Date("2026-05-11"))
    // The last item (most recent week) should be week 20
    const lastItem = result[result.length - 1]
    expect(lastItem.label).toBe("S20")
    expect(lastItem.current).toBe(6000) // 5000 + 1000
    expect(lastItem.previous).toBe(3500) // 3000 + 500
  })

  it("returns 0 for weeks with no data", () => {
    const db = makeDb({ daily_sales: [] })
    const result = buildLast4WeeksComparison(db, new Date("2026-05-11"))
    result.forEach((item) => {
      expect(item.current).toBe(0)
      expect(item.previous).toBe(0)
    })
  })
})
