import { describe, expect, it } from "vitest"
import { BREAKEVEN, calcBreakeven, calcBreakevenPct, calcMarginRate, calcNetMargin, getWeeklyBreakeven, getFoodCostStatus, effectiveVariableCostRate, FOOD_COST_SUSPECT_THRESHOLD, FOOD_COST_ALERT_THRESHOLD, FOOD_COST_FLOOR_RATE } from "../lib/calculations"

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

describe("getFoodCostStatus", () => {
  it("returns 'suspect' when pct < 20", () => {
    expect(getFoodCostStatus(0)).toBe("suspect")
    expect(getFoodCostStatus(8.6)).toBe("suspect")
    expect(getFoodCostStatus(19.9)).toBe("suspect")
  })

  it("returns 'ok' when pct is between 20 and 30 inclusive", () => {
    expect(getFoodCostStatus(20)).toBe("ok")
    expect(getFoodCostStatus(26)).toBe("ok")
    expect(getFoodCostStatus(30)).toBe("ok")
  })

  it("returns 'alert' when pct > 30", () => {
    expect(getFoodCostStatus(30.1)).toBe("alert")
    expect(getFoodCostStatus(39)).toBe("alert")
  })
})

describe("effectiveVariableCostRate", () => {
  it("returns 0.30 when food_cost < 20% (données suspectes)", () => {
    expect(effectiveVariableCostRate(0)).toBe(0.30)
    expect(effectiveVariableCostRate(8.6)).toBe(0.30)
    expect(effectiveVariableCostRate(19.9)).toBe(0.30)
  })

  it("returns floor 0.28 when food_cost is between 20% and 28%", () => {
    expect(effectiveVariableCostRate(20)).toBe(0.28)
    expect(effectiveVariableCostRate(24)).toBe(0.28)
    expect(effectiveVariableCostRate(27.9)).toBe(0.28)
  })

  it("returns actual rate when food_cost >= 28%", () => {
    expect(effectiveVariableCostRate(28)).toBeCloseTo(0.28)
    expect(effectiveVariableCostRate(31)).toBeCloseTo(0.31)
    expect(effectiveVariableCostRate(35)).toBeCloseTo(0.35)
  })
})
