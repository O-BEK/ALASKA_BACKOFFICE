"use client"

import { useEffect, useState } from "react"
import type { MonthlyKPIs } from "@/lib/types"

interface DashboardState {
  kpis: MonthlyKPIs
  delta_ca: number
  last12: { month: string; ca_caisse: number; ca_b2b: number; breakeven: number }[]
}

const emptyKpis: MonthlyKPIs = {
  month: "",
  ca_caisse: 0,
  ca_b2b: 0,
  ca_total: 0,
  ca_soir: 0,
  pct_soir: 0,
  total_expenses: 0,
  marge_nette: 0,
  taux_marge: 0,
  breakeven: 0,
  pct_breakeven: 0,
  days_count: 0,
  ca_per_day: 0,
}

export function useDashboard(month: string) {
  const [state, setState] = useState<DashboardState>({
    kpis: { ...emptyKpis, month },
    delta_ca: 0,
    last12: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)

    fetch(`/api/dashboard?month=${month}`)
      .then((response) => response.json())
      .then((data: DashboardState) => {
        if (!active) return
        setState(data)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [month])

  return { ...state, loading }
}
