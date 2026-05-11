"use client"

import { useCallback, useEffect, useState } from "react"

export const MONTHLY_SUPPLIERS = [
  { label: "Poulet", category: "MP" as const },
  { label: "Nor Saga", category: "MP" as const },
  { label: "Solidernet", category: "AUTRE" as const },
] as const

export type MonthlySupplier = (typeof MONTHLY_SUPPLIERS)[number]

interface SupplierAmounts {
  Poulet: number
  "Nor Saga": number
  Solidernet: number
}

export function useMonthlySuppliers(month: string) {
  const date = `${month}-01`
  const [amounts, setAmounts] = useState<SupplierAmounts>({ Poulet: 0, "Nor Saga": 0, Solidernet: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/daily-entry?date=${date}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
        const expenses: { label: string; amount: number; category: string }[] = json.expenses ?? []
        const newAmounts: SupplierAmounts = { Poulet: 0, "Nor Saga": 0, Solidernet: 0 }
        for (const supplier of MONTHLY_SUPPLIERS) {
          const found = expenses.find((e) => e.label === supplier.label)
          if (found) newAmounts[supplier.label as keyof SupplierAmounts] = found.amount
        }
        setAmounts(newAmounts)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Erreur de chargement"
        setError(message)
      })
      .finally(() => setLoading(false))
  }, [date])

  const save = useCallback(
    async (newAmounts: SupplierAmounts): Promise<void> => {
      setSaving(true)
      setError(null)
      try {
        // 1. Load current entry to preserve other expenses and sales data
        const getRes = await fetch(`/api/daily-entry?date=${date}`)
        const current = await getRes.json()
        if (!getRes.ok) throw new Error(current.error || `Erreur ${getRes.status}`)

        // 2. Merge supplier expenses into existing expenses array
        const existingExpenses: { label: string; amount: number; category: string }[] = current.expenses ?? []
        const supplierLabels: string[] = MONTHLY_SUPPLIERS.map((s) => s.label)
        const otherExpenses = existingExpenses.filter((e) => !supplierLabels.includes(e.label))
        const supplierExpenses = MONTHLY_SUPPLIERS.map((s) => ({
          label: s.label,
          amount: newAmounts[s.label as keyof SupplierAmounts],
          category: s.category,
        })).filter((e) => e.amount > 0)

        // 3. PUT the full merged entry
        const body = {
          ...current,
          date,
          expenses: [...otherExpenses, ...supplierExpenses],
        }
        const putRes = await fetch("/api/daily-entry", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const putJson = await putRes.json()
        if (!putRes.ok) throw new Error(putJson.error || `Erreur ${putRes.status}`)
        setAmounts(newAmounts)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erreur de sauvegarde"
        setError(message)
        throw err
      } finally {
        setSaving(false)
      }
    },
    [date]
  )

  return { amounts, setAmounts, loading, saving, error, save }
}
