"use client"

import { useCallback, useEffect, useState } from "react"
import { parseExpenseTemplatesPayload } from "@/lib/contracts"
import type { ExpenseSection } from "@/lib/types"

export function useExpenseTemplates() {
  const [sections, setSections] = useState<ExpenseSection[]>([])

  const load = useCallback(() => {
    fetch("/api/expense-templates")
      .then(async (r) => parseExpenseTemplatesPayload(await r.json()))
      .then((data) => setSections(data.sections))
      .catch(() => setSections([]))
  }, [])

  useEffect(() => { load() }, [load])

  const createSection = useCallback(async (payload: { name: string; emoji: string; expense_category: "MP" | "CHARGES" | "AUTRE" }) => {
    const r = await fetch("/api/expense-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "section", ...payload }),
    })
    if (!r.ok) return
    const data = parseExpenseTemplatesPayload(await r.json())
    setSections(data.sections)
  }, [])

  const createItem = useCallback(async (section_id: string, label: string) => {
    const r = await fetch("/api/expense-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "item", section_id, label }),
    })
    if (!r.ok) return
    const data = parseExpenseTemplatesPayload(await r.json())
    setSections(data.sections)
  }, [])

  const deleteSection = useCallback(async (id: string) => {
    const r = await fetch(`/api/expense-templates?id=${id}&type=section`, { method: "DELETE" })
    if (!r.ok) return
    const data = parseExpenseTemplatesPayload(await r.json())
    setSections(data.sections)
  }, [])

  const deleteItem = useCallback(async (id: string) => {
    const r = await fetch(`/api/expense-templates?id=${id}&type=item`, { method: "DELETE" })
    if (!r.ok) return
    const data = parseExpenseTemplatesPayload(await r.json())
    setSections(data.sections)
  }, [])

  return { sections, createSection, createItem, deleteSection, deleteItem }
}
