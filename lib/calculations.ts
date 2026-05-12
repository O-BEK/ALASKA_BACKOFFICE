export const VARIABLE_COST_RATE = 0.28
export const FIXED_CHARGES_TOTAL = 98400
export const BREAKEVEN = FIXED_CHARGES_TOTAL / (1 - VARIABLE_COST_RATE) // 136 667
export const CAISSE_RESERVE = 1000

export function calcBreakeven(fixedCharges: number, variableCostRate = VARIABLE_COST_RATE): number {
  return fixedCharges / (1 - variableCostRate)
}

export function calcNetMargin(caTotal: number, expenses: number): number {
  return caTotal - expenses - caTotal * VARIABLE_COST_RATE
}

export function calcMarginRate(netMargin: number, caTotal: number): number {
  if (caTotal === 0) return 0
  return (netMargin / caTotal) * 100
}

export function calcBreakevenPct(caTotal: number, breakeven: number): number {
  if (breakeven === 0) return 0
  return (caTotal / breakeven) * 100
}

export function calcYearEndProjection(cumulativeReal: number, monthsDone: number, totalMonths = 12): number {
  if (monthsDone === 0) return 0
  const monthlyAvg = cumulativeReal / monthsDone
  return cumulativeReal + monthlyAvg * (totalMonths - monthsDone)
}

export function getBreakevenColor(pct: number): "red" | "orange" | "green" {
  if (pct >= 100) return "green"
  if (pct >= 70) return "orange"
  return "red"
}

export function getWeeklyBreakeven(): number {
  return BREAKEVEN / 4.33
}

export const FOOD_COST_SUSPECT_THRESHOLD = 20
export const FOOD_COST_ALERT_THRESHOLD = 30
export const FOOD_COST_FLOOR_RATE = 0.28

export type FoodCostStatus = "suspect" | "ok" | "alert"

export function getFoodCostStatus(pct: number): FoodCostStatus {
  if (pct < FOOD_COST_SUSPECT_THRESHOLD) return "suspect"
  if (pct > FOOD_COST_ALERT_THRESHOLD) return "alert"
  return "ok"
}

export function effectiveVariableCostRate(foodCostPct: number): number {
  if (foodCostPct < FOOD_COST_SUSPECT_THRESHOLD) return 0.30
  return Math.max(foodCostPct / 100, FOOD_COST_FLOOR_RATE)
}
