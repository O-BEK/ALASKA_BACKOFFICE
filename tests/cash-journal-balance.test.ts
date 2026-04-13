import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { buildCaisseBalance } from "../lib/server/analytics"
import type { PilotDb } from "../lib/server/db-types"

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
    date: "2026-04-01",
    ca_caisse: 1000,
    ca_b2b: 0,
    ca_soir: 0,
    pct_soir: 0,
    tickets_count: 0,
    mouvement_caisse: -50,
    cash_sales_journal: null,
    cash_movements_journal: null,
    cash_opening_fund: null,
    cash_closing_fund: null,
    cash_journal_sessions: 0,
    cash_journal_anomaly: false,
    cash_journal_import_id: null,
    notes: "",
    source: "csv_import",
    import_id: null,
    created_by: null,
    updated_at: "",
    ...overrides,
  }
}

describe("buildCaisseBalance journal priority", () => {
  it("uses journal cash values when available", () => {
    const result = buildCaisseBalance(
      makeDb({
        daily_sales: [
          makeSale({
            date: "2026-04-10",
            ca_caisse: 1000,
            mouvement_caisse: -50,
            cash_sales_journal: 1300,
            cash_movements_journal: -200,
            cash_journal_sessions: 1,
            cash_journal_import_id: "imp-1",
          }),
        ],
        expenses: [
          { id: "exp-1", date: "2026-04-10", category: "MP", label: "Courses", amount: 400, notes: "", created_by: null, updated_at: "" },
        ],
      }),
      "2026-04-01"
    )

    expect(result.balance).toBe(700)
  })

  it("falls back to legacy cash fields when no journal import exists", () => {
    const result = buildCaisseBalance(
      makeDb({
        daily_sales: [
          makeSale({
            date: "2026-04-10",
            ca_caisse: 1000,
            mouvement_caisse: -50,
          }),
        ],
        expenses: [
          { id: "exp-1", date: "2026-04-10", category: "MP", label: "Courses", amount: 400, notes: "", created_by: null, updated_at: "" },
        ],
      }),
      "2026-04-01"
    )

    expect(result.balance).toBe(550)
  })
})
