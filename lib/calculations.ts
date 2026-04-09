export const VARIABLE_COST_RATE = 0.28
export const FIXED_CHARGES_TOTAL = 98400
export const BREAKEVEN = FIXED_CHARGES_TOTAL / (1 - VARIABLE_COST_RATE) // 136 667
export const CAISSE_RESERVE = 1000

export function calcBreakeven(fixedCharges: number, variableCostRate = VARIABLE_COST_RATE): number {
  return fixedCharges / (1 - variableCostRate)
}

export function calcNetMargin(caCaisse: number, expenses: number): number {
  return caCaisse - expenses - caCaisse * VARIABLE_COST_RATE
}

export function calcMarginRate(netMargin: number, caCaisse: number): number {
  if (caCaisse === 0) return 0
  return (netMargin / caCaisse) * 100
}

export function calcBreakevenPct(caCaisse: number, breakeven: number): number {
  if (breakeven === 0) return 0
  return (caCaisse / breakeven) * 100
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
