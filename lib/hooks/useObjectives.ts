"use client"

import { useEffect, useMemo, useState } from "react"
import type { ActionItem, MonthlyObjective, Objective } from "@/lib/types"

interface ObjectivePayload {
  actions: ActionItem[]
  objectives: Objective[]
  monthlyObjectives: MonthlyObjective[]
  monthlyReal: { year: number; month: number; real: number; target: number; notes: string }[]
}

export function useObjectives() {
  const [data, setData] = useState<ObjectivePayload>({
    actions: [],
    objectives: [],
    monthlyObjectives: [],
    monthlyReal: [],
  })

  useEffect(() => {
    fetch("/api/objectives")
      .then(async (response) => {
        const payload = (await response.json()) as Partial<ObjectivePayload>
        return {
          actions: Array.isArray(payload.actions) ? payload.actions : [],
          objectives: Array.isArray(payload.objectives) ? payload.objectives : [],
          monthlyObjectives: Array.isArray(payload.monthlyObjectives) ? payload.monthlyObjectives : [],
          monthlyReal: Array.isArray(payload.monthlyReal) ? payload.monthlyReal : [],
        } satisfies ObjectivePayload
      })
      .then((payload) => setData(payload))
      .catch(() =>
        setData({
          actions: [],
          objectives: [],
          monthlyObjectives: [],
          monthlyReal: [],
        })
      )
  }, [])

  const updateActionStatus = async (id: string, status: ActionItem["status"]) => {
    const response = await fetch("/api/objectives", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
    if (!response.ok) return
    const payload = await response.json()
    setData((prev) => ({ ...prev, actions: Array.isArray(payload.actions) ? (payload.actions as ActionItem[]) : prev.actions }))
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
    updateActionStatus,
    cumulativeReal,
    monthsDone,
    yearlyTarget,
    pctAnnuel,
    byLever,
    monthlyObjectives: data.monthlyObjectives,
    monthlyReal: data.monthlyReal,
  }
}
