"use client"

import { useEffect, useMemo, useState } from "react"
import { parseChargesPayload } from "@/lib/contracts"
import type { FixedCharge } from "@/lib/types"
import { calcBreakeven } from "@/lib/calculations"

export function useCharges() {
  const [charges, setCharges] = useState<FixedCharge[]>([])
  const [simExtra, setSimExtra] = useState(0)

  useEffect(() => {
    fetch("/api/charges")
      .then(async (response) => parseChargesPayload(await response.json()))
      .then((data) => setCharges(data.charges))
      .catch(() => setCharges([]))
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
    if (!response.ok) return
    const data = parseChargesPayload(await response.json())
    setCharges(data.charges)
  }

  const deactivateCharge = async (id: string) => {
    const response = await fetch("/api/charges", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: false }),
    })
    if (!response.ok) return
    const data = parseChargesPayload(await response.json())
    setCharges(data.charges)
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
