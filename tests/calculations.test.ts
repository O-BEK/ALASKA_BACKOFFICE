import { describe, expect, it } from "vitest"
import { BREAKEVEN, calcBreakeven, calcBreakevenPct, calcMarginRate, calcNetMargin, getWeeklyBreakeven } from "../lib/calculations"

describe("financial calculations", () => {
  it("calculates breakeven from fixed charges", () => {
    expect(calcBreakeven(98400)).toBeCloseTo(BREAKEVEN, 3)
  })

  it("calculates net margin and rate", () => {
    const margin = calcNetMargin(10000, 2500)
    expect(margin).toBe(4700)
    expect(calcMarginRate(margin, 10000)).toBe(47)
  })

  it("calculates breakeven percentage and weekly threshold", () => {
    expect(calcBreakevenPct(68333.5, 136667)).toBeCloseTo(50, 1)
    expect(getWeeklyBreakeven()).toBeCloseTo(BREAKEVEN / 4.33, 5)
  })

  it("calculates dynamic breakeven from charges array", () => {
    const charges = [
      { is_active: true, amount: 34000 },
      { is_active: true, amount: 6000 },
      { is_active: false, amount: 99999 }, // ignoré
    ]
    const total = charges.filter(c => c.is_active).reduce((s, c) => s + c.amount, 0)
    expect(calcBreakeven(total)).toBeCloseTo(55555.6, 0)
  })
})
