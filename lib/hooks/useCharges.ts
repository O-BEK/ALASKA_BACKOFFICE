"use client"

import { useEffect, useMemo, useState } from "react"
import type { FixedCharge } from "@/lib/types"
import { calcBreakeven } from "@/lib/calculations"

export function useCharges() {
  const [charges, setCharges] = useState<FixedCharge[]>([])
  const [simExtra, setSimExtra] = useState(0)

  useEffect(() => {
    fetch("/api/charges")
      .then((response) => response.json())
      .then((data) => setCharges(data.charges as FixedCharge[]))
  }, [])

  const totalActive = useMemo(
    () => charges.filter((item) => item.is_active).reduce((sum, item) => sum + item.amount, 0),
    [charges]
  )
  const breakeven = calcBreakeven(totalActive)
  const simulatedTotal = totalActive + simExtra
  const simulatedBreakeven = calcBreakeven(simulatedTotal)

  const updateCharge = async (id: string, amount: number) => {
    const response = await fetch("/api/charges", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, amount }),
    })
    const data = await response.json()
    setCharges(data.charges as FixedCharge[])
  }

  const deactivateCharge = async (id: string) => {
    const response = await fetch("/api/charges", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: false }),
    })
    const data = await response.json()
    setCharges(data.charges as FixedCharge[])
  }

  const byCategory = useMemo(
    () =>
      charges.filter((item) => item.is_active).reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = []
        acc[item.category].push(item)
        return acc
      }, {} as Record<string, FixedCharge[]>),
    [charges]
  )

  return {
    charges,
    byCategory,
    totalActive,
    breakeven,
    simExtra,
    setSimExtra,
    simulatedTotal,
    simulatedBreakeven,
    updateCharge,
    deactivateCharge,
  }
}
