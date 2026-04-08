"use client"

import { format } from "date-fns"
import { useEffect, useState } from "react"
import { parseWeekPayload } from "@/lib/contracts"

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
      .then(async (response) => parseWeekPayload(await response.json()))
      .then((payload) => {
        if (!active) return
        setData(payload.summary)
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
