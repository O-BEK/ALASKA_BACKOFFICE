"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { parseDailyEntry } from "@/lib/contracts"
import type { DailyEntry, ExpenseItem } from "@/lib/types"

function emptyEntry(date: string): DailyEntry {
  return {
    date,
    ca_caisse: 0,
    ca_b2b: 0,
    ca_soir: 0,
    pct_soir: 0,
    tickets_count: 0,
    mouvement_caisse: 0,
    cash_sales_journal: null,
    cash_movements_journal: null,
    cash_opening_fund: null,
    cash_closing_fund: null,
    cash_journal_sessions: 0,
    cash_journal_anomaly: false,
    cash_journal_import_id: null,
    notes: "",
    source: "manual",
    expenses: [],
  }
}

async function persistEntry(entry: DailyEntry) {
  const response = await fetch("/api/daily-entry", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  })

  if (!response.ok) throw new Error("Erreur de sauvegarde")
  return parseDailyEntry(await response.json())
}

export function useDailyEntry(date: string) {
  const [entry, setEntry] = useState<DailyEntry>(emptyEntry(date))
  const [saved, setSaved] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    let active = true
    fetch(`/api/daily-entry?date=${date}`)
      .then(async (response) => parseDailyEntry(await response.json()))
      .then((data) => {
        if (active) {
          setEntry(data)
          setSaved(true)
        }
      })
      .catch(() => {
        if (active) {
          setEntry(emptyEntry(date))
          setSaved(true)
        }
      })

    return () => {
      active = false
    }
  }, [date])

  const queueSave = useCallback((next: DailyEntry) => {
    setSaved(false)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const savedEntry = await persistEntry(next)
      setEntry(savedEntry)
      setSaved(true)
    }, 2000)
  }, [])

  const update = useCallback((patch: Partial<DailyEntry>) => {
    setEntry((prev) => {
      const next = { ...prev, ...patch }
      queueSave(next)
      return next
    })
  }, [queueSave])

  const updateExpense = useCallback((id: string, amount: number) => {
    setEntry((prev) => {
      const expenses = prev.expenses.map((item) => (item.id === id ? { ...item, amount } : item))
      const next = { ...prev, expenses }
      queueSave(next)
      return next
    })
  }, [queueSave])

  const addExpense = useCallback((expense: ExpenseItem) => {
    setEntry((prev) => {
      const next = { ...prev, expenses: [...prev.expenses, expense] }
      queueSave(next)
      return next
    })
  }, [queueSave])

  const save = useCallback(async () => {
    clearTimeout(timerRef.current)
    const savedEntry = await persistEntry(entry)
    setEntry(savedEntry)
    setSaved(true)
  }, [entry])

  return { entry, update, updateExpense, addExpense, save, saved }
}
