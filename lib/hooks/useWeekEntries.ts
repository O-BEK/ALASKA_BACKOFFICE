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
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`)
  return parseDailyEntry(json)
}

export function useWeekEntries(weekStart: Date) {
  const dates = Array.from({ length: 7 }, (_, index) => format(addDays(weekStart, index), "yyyy-MM-dd"))
  const [entries, setEntries] = useState<Record<string, DailyEntry>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const start = format(weekStart, "yyyy-MM-dd")
    setError(null)
    fetch(`/api/week?start=${start}`)
      .then(async (response) => {
        const json = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`)
        return parseWeekPayload(json)
      })
      .then((payload) => {
        if (active) setEntries(payload.entries)
      })
      .catch((err: unknown) => {
        if (active) {
          setEntries({})
          setError(err instanceof Error ? err.message : "Impossible de charger la semaine.")
        }
      })

    return () => {
      active = false
    }
  }, [weekStart])

  const updateCA = async (date: string, ca: number) => {
    const current = entries[date]
    if (!current || current.source === "csv_import" || current.cash_journal_sessions > 0 || current.cash_journal_import_id) return
    const next = { ...current, ca_caisse: Math.max(0, ca) }
    setEntries((prev) => ({ ...prev, [date]: next }))
    try {
      const saved = await saveEntry(next)
      setEntries((prev) => ({ ...prev, [date]: saved }))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de sauvegarde semaine")
    }
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
    try {
      const saved = await saveEntry(next)
      setEntries((prev) => ({ ...prev, [date]: saved }))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de sauvegarde semaine")
    }
  }

  return { entries, dates, updateCA, updateExpense, error }
}
