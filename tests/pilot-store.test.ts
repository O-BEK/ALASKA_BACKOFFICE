import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { applyImportedSales, replaceExpensesForDate, toDailyEntry, type PilotDb, type ExpenseRecord } from "../lib/server/pilot-store"

function makeDb(): PilotDb {
  return {
    users: [],
    daily_sales: [
      {
        id: "sale_1",
        date: "2026-04-07",
        ca_caisse: 100,
        ca_b2b: 250,
        ca_soir: 0,
        pct_soir: 0,
        tickets_count: 1,
        notes: "service midi",
        source: "manual",
        import_id: null,
        created_by: "user_admin",
        updated_at: new Date().toISOString(),
      },
    ],
    expenses: [
      {
        id: "exp_1",
        date: "2026-04-07",
        category: "MP",
        label: "Boucher",
        amount: 80,
        notes: "",
        created_by: "user_admin",
        updated_at: new Date().toISOString(),
      },
    ],
    fixed_charges: [],
    objectives: [],
    monthly_objectives: [],
    action_items: [],
    import_history: [],
  }
}

describe("pilot store merge rules", () => {
  it("preserves manual notes and b2b data on csv import", () => {
    const db = makeDb()

    applyImportedSales(
      db,
      [{ date: "2026-04-07", ca_caisse: 220, ca_soir: 90, pct_soir: 41, tickets_count: 6 }],
      { importId: "import_1", userId: "user_admin" }
    )

    expect(db.daily_sales[0]).toMatchObject({
      date: "2026-04-07",
      ca_caisse: 220,
      ca_b2b: 250,
      notes: "service midi",
      source: "csv_import",
      import_id: "import_1",
    })
  })

  it("replaces day expenses with the persisted set", () => {
    const db = makeDb()
    const nextExpenses: ExpenseRecord[] = [
      {
        id: "exp_2",
        date: "2026-04-07",
        category: "RH",
        label: "Ramzi",
        amount: 300,
        notes: "",
        created_by: "user_manager",
        updated_at: new Date().toISOString(),
      },
    ]

    replaceExpensesForDate(db, "2026-04-07", nextExpenses)
    const entry = toDailyEntry(db.daily_sales[0], db.expenses, "2026-04-07")

    expect(entry.expenses).toHaveLength(1)
    expect(entry.expenses[0]).toMatchObject({ label: "Ramzi", amount: 300, category: "RH" })
  })
})
