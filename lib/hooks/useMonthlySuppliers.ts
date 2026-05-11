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

const SOLIDERNET_DEFAULT_MP_PCT = 15

export function useMonthlySuppliers(month: string) {
  const date = `${month}-01`
  const [amounts, setAmounts] = useState<SupplierAmounts>({ Poulet: 0, "Nor Saga": 0, Solidernet: 0 })
  const [solidernetMpPct, setSolidernetMpPct] = useState(SOLIDERNET_DEFAULT_MP_PCT)
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

        // Poulet + Nor Saga : une seule ligne MP
        for (const supplier of MONTHLY_SUPPLIERS.filter((s) => s.label !== "Solidernet")) {
          const found = expenses.find((e) => e.label === supplier.label)
          if (found) newAmounts[supplier.label as keyof SupplierAmounts] = found.amount
        }

        // Solidernet : peut être splitté en MP (part alimentaire) + AUTRE
        const solidernetRows = expenses.filter((e) => e.label === "Solidernet")
        const solidernetTotal = solidernetRows.reduce((sum, e) => sum + e.amount, 0)
        const solidernetMpAmount = solidernetRows.find((e) => e.category === "MP")?.amount ?? 0
        newAmounts["Solidernet"] = solidernetTotal
        if (solidernetTotal > 0) {
          setSolidernetMpPct(Math.round((solidernetMpAmount / solidernetTotal) * 100))
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
        const getRes = await fetch(`/api/daily-entry?date=${date}`)
        const current = await getRes.json()
        if (!getRes.ok) throw new Error(current.error || `Erreur ${getRes.status}`)

        const existingExpenses: { label: string; amount: number; category: string }[] = current.expenses ?? []
        const supplierLabels: string[] = MONTHLY_SUPPLIERS.map((s) => s.label)
        const otherExpenses = existingExpenses.filter((e) => !supplierLabels.includes(e.label))

        const supplierExpenses: { label: string; amount: number; category: string }[] = []

        // Poulet + Nor Saga : ligne MP unique
        for (const supplier of MONTHLY_SUPPLIERS.filter((s) => s.label !== "Solidernet")) {
          const amount = newAmounts[supplier.label as keyof SupplierAmounts]
          if (amount > 0) supplierExpenses.push({ label: supplier.label, amount, category: supplier.category })
        }

        // Solidernet : split MP (part alimentaire) + AUTRE (produits non alimentaires)
        const solidernetTotal = newAmounts["Solidernet"]
        if (solidernetTotal > 0) {
          const mpAmount = Math.round((solidernetTotal * solidernetMpPct) / 100)
          const autreAmount = solidernetTotal - mpAmount
          if (mpAmount > 0) supplierExpenses.push({ label: "Solidernet", amount: mpAmount, category: "MP" })
          if (autreAmount > 0) supplierExpenses.push({ label: "Solidernet", amount: autreAmount, category: "AUTRE" })
        }

        const putRes = await fetch("/api/daily-entry", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...current, date, expenses: [...otherExpenses, ...supplierExpenses] }),
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
    [date, solidernetMpPct]
  )

  return { amounts, setAmounts, solidernetMpPct, setSolidernetMpPct, loading, saving, error, save }
}
