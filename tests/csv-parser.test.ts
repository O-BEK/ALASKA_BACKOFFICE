import { describe, expect, it } from "vitest"
import { parseCSV } from "../lib/csv-parser"

describe("parseCSV", () => {
  it("aggregates rows by date and computes soir/tickets", () => {
    const csv = [
      '"Date","Heure","Num ticket","Prix de vente","Quantité"',
      '"07/04/2026","18:30","T1","100","1"',
      '"07/04/2026","20:15","T2","50","2"',
      '"08/04/2026","21:00","T3","80","1"',
    ].join("\n")

    const parsed = parseCSV(csv)

    expect(parsed).toHaveLength(2)
    // Sans colonne "Moyens de paiements", tout va dans ca_b2b (non-cash par défaut)
    expect(parsed[0]).toMatchObject({
      date: "2026-04-07",
      ca_caisse: 0,
      ca_b2b: 200,
      ca_soir: 100,
      tickets_count: 2,
    })
    expect(parsed[0].pct_soir).toBeCloseTo(50, 3)
    expect(parsed[1]).toMatchObject({
      date: "2026-04-08",
      ca_caisse: 0,
      ca_b2b: 80,
      ca_soir: 80,
      tickets_count: 1,
    })
  })

  it("rejects unsupported files", () => {
    expect(() => parseCSV("foo")).toThrow()
  })
})
