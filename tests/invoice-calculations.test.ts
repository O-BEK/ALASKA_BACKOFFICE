import { describe, it, expect } from "vitest"
import { calcLineTotalHt, calcInvoiceTotals } from "../lib/invoice-calculations"

describe("calcLineTotalHt", () => {
  it("multiplies quantity by unit_price_ht", () => {
    expect(calcLineTotalHt({ quantity: 3, unit_price_ht: 500, tva_rate: 10 })).toBe(1500)
  })
  it("returns 0 when quantity is 0", () => {
    expect(calcLineTotalHt({ quantity: 0, unit_price_ht: 500, tva_rate: 10 })).toBe(0)
  })
  it("handles decimal quantities", () => {
    expect(calcLineTotalHt({ quantity: 1.5, unit_price_ht: 200, tva_rate: 10 })).toBe(300)
  })
})

describe("calcInvoiceTotals", () => {
  it("computes totals for a single line at TVA 10%", () => {
    const result = calcInvoiceTotals([{ quantity: 2, unit_price_ht: 1000, tva_rate: 10 }])
    expect(result.total_ht).toBe(2000)
    expect(result.tva_amount).toBeCloseTo(200)
    expect(result.total_ttc).toBeCloseTo(2200)
  })
  it("sums multiple lines correctly", () => {
    const lines = [
      { quantity: 1, unit_price_ht: 500, tva_rate: 10 },
      { quantity: 4, unit_price_ht: 250, tva_rate: 10 },
    ]
    const result = calcInvoiceTotals(lines)
    expect(result.total_ht).toBe(1500)
    expect(result.tva_amount).toBeCloseTo(150)
    expect(result.total_ttc).toBeCloseTo(1650)
  })
  it("returns zero totals for empty lines", () => {
    const result = calcInvoiceTotals([])
    expect(result.total_ht).toBe(0)
    expect(result.tva_amount).toBe(0)
    expect(result.total_ttc).toBe(0)
  })
  it("applies tva_rate per line independently", () => {
    const lines = [
      { quantity: 1, unit_price_ht: 1000, tva_rate: 10 },
      { quantity: 1, unit_price_ht: 1000, tva_rate: 20 },
    ]
    const result = calcInvoiceTotals(lines)
    expect(result.total_ht).toBe(2000)
    expect(result.tva_amount).toBeCloseTo(300) // 100 + 200
    expect(result.total_ttc).toBeCloseTo(2300)
  })
})
