"use client"

import { format } from "date-fns"
import { useEffect, useState } from "react"

interface WeekSummary {
  days: {
    date: string
    label: string
    entry: any
    totalExpenses: number
    status: "empty" | "partial" | "full"
  }[]
  totalCA: number
  totalDep: number
  marge: number
  weeklyBreakeven: number
  pctBreakeven: number
  expensesByLabel: { label: string; amount: number }[]
}

const emptySummary: WeekSummary = {
  days: [],
  totalCA: 0,
  totalDep: 0,
  marge: 0,
  weeklyBreakeven: 0,
  pctBreakeven: 0,
  expensesByLabel: [],
}

export function useWeekView(weekStart: Date) {
  const [data, setData] = useState<WeekSummary>(emptySummary)

  useEffect(() => {
    let active = true
    const start = format(weekStart, "yyyy-MM-dd")
    fetch(`/api/week?start=${start}`)
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return
        const summary = payload?.summary as Partial<WeekSummary> | undefined
        setData({
          days: Array.isArray(summary?.days) ? summary.days : [],
          totalCA: typeof summary?.totalCA === "number" ? summary.totalCA : 0,
          totalDep: typeof summary?.totalDep === "number" ? summary.totalDep : 0,
          marge: typeof summary?.marge === "number" ? summary.marge : 0,
          weeklyBreakeven: typeof summary?.weeklyBreakeven === "number" ? summary.weeklyBreakeven : 0,
          pctBreakeven: typeof summary?.pctBreakeven === "number" ? summary.pctBreakeven : 0,
          expensesByLabel: Array.isArray(summary?.expensesByLabel) ? summary.expensesByLabel : [],
        })
      })
      .catch(() => {
        if (active) setData(emptySummary)
      })

    return () => {
      active = false
    }
  }, [weekStart])

  return data
}
