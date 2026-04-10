"use client"

import { useEffect, useState } from "react"
import { parseDashboardState } from "@/lib/contracts"
import type { MonthlyKPIs } from "@/lib/types"

interface DashboardState {
  kpis: MonthlyKPIs
  delta_ca: number
  last12: { month: string; ca_caisse: number; ca_b2b: number; ca_total: number; breakeven: number }[]
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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetch(`/api/dashboard?month=${month}`)
      .then(async (response) => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`)
        return parseDashboardState(json, month)
      })
      .then((data) => {
        if (!active) return
        setState(data)
      })
      .catch((err: unknown) => {
        if (!active) return
        const message = err instanceof Error ? err.message : "Erreur de chargement"
        setError(message)
        setState({ kpis: { ...emptyKpis, month }, delta_ca: 0, last12: [] })
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [month])

  return { ...state, loading, error }
}
