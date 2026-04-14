"use client"

import { useEffect, useMemo, useState } from "react"
import { parseObjectivesPayload } from "@/lib/contracts"
import type { ActionItem, MonthlyObjective, Objective } from "@/lib/types"

interface ObjectivePayload {
  actions: ActionItem[]
  objectives: Objective[]
  monthlyObjectives: MonthlyObjective[]
  monthlyReal: { year: number; month: number; real: number; target: number; notes: string }[]
}

const EMPTY_PAYLOAD: ObjectivePayload = {
  actions: [],
  objectives: [],
  monthlyObjectives: [],
  monthlyReal: [],
}

export function useObjectives() {
  const [data, setData] = useState<ObjectivePayload>(EMPTY_PAYLOAD)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/objectives")
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return parseObjectivesPayload(await response.json())
      })
      .then((payload) => {
        setData(payload)
        setError(null)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Erreur inconnue")
        setData(EMPTY_PAYLOAD)
      })
  }, [])

  const updateActionStatus = async (id: string, status: ActionItem["status"]) => {
    const response = await fetch("/api/objectives", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
    if (!response.ok) {
      const json = await response.json().catch(() => ({}))
      setError(json?.error ?? "Impossible de mettre à jour l'action.")
      return
    }
    const payload = parseObjectivesPayload(await response.json())
    setData((prev) => ({ ...prev, actions: payload.actions }))
  }

  const createAction = async (
    body: Omit<ActionItem, "id" | "status"> & { budget_min: number; budget_max: number }
  ) => {
    setError(null)
    const response = await fetch("/api/objectives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const json = await response.json().catch(() => ({}))
      setError(json?.error ?? "Impossible de créer l'action.")
      return
    }
    const payload = parseObjectivesPayload(await response.json())
    setData((prev) => ({ ...prev, actions: payload.actions }))
  }

  const updateAction = async (payload: Partial<ActionItem> & { id: string }) => {
    setError(null)
    const response = await fetch("/api/objectives", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const json = await response.json().catch(() => ({}))
      setError(json?.error ?? "Impossible de mettre à jour l'action.")
      return
    }
    const parsed = parseObjectivesPayload(await response.json())
    setData((prev) => ({ ...prev, actions: parsed.actions }))
  }

  const deleteAction = async (id: string) => {
    setError(null)
    const response = await fetch(`/api/objectives?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      const json = await response.json().catch(() => ({}))
      setError(json?.error ?? "Impossible de supprimer l'action.")
      return
    }
    const payload = parseObjectivesPayload(await response.json())
    setData((prev) => ({ ...prev, actions: payload.actions }))
  }

  const updateMonthlyObjective = async (year: number, month: number, target_ca: number) => {
    setError(null)
    const response = await fetch("/api/objectives/monthly", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, target_ca }),
    })
    if (!response.ok) {
      const json = await response.json().catch(() => ({}))
      setError(json?.error ?? "Impossible de mettre à jour l'objectif mensuel.")
      return
    }
    const json = await response.json()
    const newMonthlyObjectives: MonthlyObjective[] = Array.isArray(json?.monthlyObjectives)
      ? json.monthlyObjectives
      : []
    setData((prev) => ({ ...prev, monthlyObjectives: newMonthlyObjectives }))
  }

  const cumulativeReal = data.monthlyReal.reduce((sum, item) => sum + item.real, 0)
  const monthsDone = data.monthlyReal.filter((item) => item.real > 0).length
  const yearlyTarget =
    data.objectives.find((item) => item.year === 2026 && item.scenario === "realistic")?.target_amount || 2277882
  const pctAnnuel = yearlyTarget > 0 ? (cumulativeReal / yearlyTarget) * 100 : 0

  const byLever = useMemo(
    () =>
      (["soir", "terrasse", "b2b", "marketing", "pilotage"] as const).map((lever) => {
        const all = data.actions.filter((item) => item.lever === lever)
        const done = all.filter((item) => item.status === "done").length
        return { lever, total: all.length, done, pct: all.length > 0 ? (done / all.length) * 100 : 0 }
      }),
    [data.actions]
  )

  return {
    actions: data.actions,
    error,
    updateActionStatus,
    createAction,
    updateAction,
    deleteAction,
    updateMonthlyObjective,
    cumulativeReal,
    monthsDone,
    yearlyTarget,
    pctAnnuel,
    byLever,
    monthlyObjectives: data.monthlyObjectives,
    monthlyReal: data.monthlyReal,
  }
}
