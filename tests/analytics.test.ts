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

describe("buildCaisseBalance", () => {
  it("computes balance and toDeposit from all sales and expenses", () => {
    const db = makeDb({
      daily_sales: [
        { id: "s1", date: "2026-01-01", ca_caisse: 5000, ca_b2b: 0, ca_soir: 0, pct_soir: 0, tickets_count: 30, mouvement_caisse: 0, notes: "", source: "manual", import_id: null, created_by: null, updated_at: "" },
        { id: "s2", date: "2026-01-02", ca_caisse: 3000, ca_b2b: 0, ca_soir: 0, pct_soir: 0, tickets_count: 20, mouvement_caisse: 0, notes: "", source: "manual", import_id: null, created_by: null, updated_at: "" },
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
        { id: "s1", date: "2026-01-01", ca_caisse: 800, ca_b2b: 0, ca_soir: 0, pct_soir: 0, tickets_count: 5, mouvement_caisse: 0, notes: "", source: "manual", import_id: null, created_by: null, updated_at: "" },
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
