"use client"

import { addDays, format } from "date-fns"
import { useEffect, useState } from "react"
import { parseDailyEntry, parseWeekPayload } from "@/lib/contracts"
import type { DailyEntry, ExpenseItem } from "@/lib/types"

async function saveEntry(entry: DailyEntry) {
  const response = await fetch("/api/daily-entry", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  })
  if (!response.ok) throw new Error("Erreur de sauvegarde semaine")
  return parseDailyEntry(await response.json())
}

export function useWeekEntries(weekStart: Date) {
  const dates = Array.from({ length: 7 }, (_, index) => format(addDays(weekStart, index), "yyyy-MM-dd"))
  const [entries, setEntries] = useState<Record<string, DailyEntry>>({})

  useEffect(() => {
    let active = true
    const start = format(weekStart, "yyyy-MM-dd")
    fetch(`/api/week?start=${start}`)
      .then(async (response) => parseWeekPayload(await response.json()))
      .then((payload) => {
        if (active) setEntries(payload.entries)
      })
      .catch(() => {
        if (active) setEntries({})
      })

    return () => {
      active = false
    }
  }, [weekStart])

  const updateCA = async (date: string, ca: number) => {
    const current = entries[date]
    if (!current) return
    const next = { ...current, ca_caisse: Math.max(0, ca) }
    setEntries((prev) => ({ ...prev, [date]: next }))
    const saved = await saveEntry(next)
    setEntries((prev) => ({ ...prev, [date]: saved }))
  }

  const updateExpense = async (
    date: string,
    category: "MP" | "RH" | "CHARGES" | "AUTRE",
    label: string,
    amount: number
  ) => {
    const current = entries[date]
    if (!current) return

    const others = current.expenses.filter((item) => !(item.category === category && item.label === label))
    const expenses: ExpenseItem[] = amount > 0
      ? [...others, { id: `${category}-${label}-${date}`, category, label, amount }]
      : others

    const next = { ...current, expenses }
    setEntries((prev) => ({ ...prev, [date]: next }))
    const saved = await saveEntry(next)
    setEntries((prev) => ({ ...prev, [date]: saved }))
  }

  return { entries, dates, updateCA, updateExpense }
}
