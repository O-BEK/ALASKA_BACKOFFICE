"use client"

import { useEffect, useState } from "react"
import { parseDashboardState } from "@/lib/contracts"
import type { MonthlyKPIs } from "@/lib/types"

interface DashboardState {
  kpis: MonthlyKPIs
  delta_ca: number
  delta_expenses: number
  delta_marge: number
  last12: { month: string; ca_caisse: number; ca_b2b: number; ca_total: number; breakeven: number }[]
  hasMonthData: boolean
  monthObjective: {
    target: number | null
    real: number
    pct: number
    remaining: number
    daily_target: number
    note: string
  }
  today: {
    date: string
    ca_caisse: number
    ca_b2b: number
    ca_total: number
    total_expenses: number
    notes: string[]
    status: "missing" | "partial" | "complete"
  }
  cashMonth: {
    month: string
    cash_sales: number
    cash_movements: number
    cash_purchases: number
    cash_envelope: number
    ca_global: number
    anomaly_days: number
    days_count: number
  }
  weeklyMonth: {
    label: string
    range: string
    ca_total: number
    days_count: number
    ca_per_day: number
    breakeven: number
  }[]
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

export function useDashboard(month: string, enabled = true) {
  const [state, setState] = useState<DashboardState>({
    kpis: { ...emptyKpis, month },
    delta_ca: 0,
    delta_expenses: 0,
    delta_marge: 0,
    last12: [],
    hasMonthData: false,
    monthObjective: {
      target: null,
      real: 0,
      pct: 0,
      remaining: 0,
      daily_target: 0,
      note: "",
    },
    today: {
      date: "",
      ca_caisse: 0,
      ca_b2b: 0,
      ca_total: 0,
      total_expenses: 0,
      notes: [],
      status: "missing",
    },
    cashMonth: {
      month,
      cash_sales: 0,
      cash_movements: 0,
      cash_purchases: 0,
      cash_envelope: 0,
      ca_global: 0,
      anomaly_days: 0,
      days_count: 0,
    },
    weeklyMonth: [],
  })
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    if (!enabled) {
      setState({
        kpis: { ...emptyKpis, month },
        delta_ca: 0,
        delta_expenses: 0,
        delta_marge: 0,
        last12: [],
        hasMonthData: false,
        monthObjective: {
          target: null,
          real: 0,
          pct: 0,
          remaining: 0,
          daily_target: 0,
          note: "",
        },
        today: {
          date: "",
          ca_caisse: 0,
          ca_b2b: 0,
          ca_total: 0,
          total_expenses: 0,
          notes: [],
          status: "missing",
        },
        cashMonth: {
          month,
          cash_sales: 0,
          cash_movements: 0,
          cash_purchases: 0,
          cash_envelope: 0,
          ca_global: 0,
          anomaly_days: 0,
          days_count: 0,
        },
        weeklyMonth: [],
      })
      setError(null)
      setLoading(false)
      return () => {
        active = false
      }
    }

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
        setState({
          kpis: { ...emptyKpis, month },
          delta_ca: 0,
          delta_expenses: 0,
          delta_marge: 0,
          last12: [],
          hasMonthData: false,
          monthObjective: {
            target: null,
            real: 0,
            pct: 0,
            remaining: 0,
            daily_target: 0,
            note: "",
          },
          today: {
            date: "",
            ca_caisse: 0,
            ca_b2b: 0,
            ca_total: 0,
            total_expenses: 0,
            notes: [],
            status: "missing",
          },
          cashMonth: {
            month,
            cash_sales: 0,
            cash_movements: 0,
            cash_purchases: 0,
            cash_envelope: 0,
            ca_global: 0,
            anomaly_days: 0,
            days_count: 0,
          },
          weeklyMonth: [],
        })
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [enabled, month])

  return { ...state, loading, error }
}
