"use client"
import { DailyEntry } from "./types"

const KEY_ENTRIES = "alaska_daily_entries"
const KEY_MONTH = "alaska_selected_month"

export function getLocalEntries(): Record<string, DailyEntry> {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(localStorage.getItem(KEY_ENTRIES) || "{}")
  } catch {
    return {}
  }
}

export function saveLocalEntry(entry: DailyEntry): void {
  const all = getLocalEntries()
  all[entry.date] = entry
  localStorage.setItem(KEY_ENTRIES, JSON.stringify(all))
}

export function getLocalEntry(date: string): DailyEntry | null {
  return getLocalEntries()[date] || null
}

export function getSelectedMonth(): string {
  if (typeof window === "undefined") return "2026-04"
  return localStorage.getItem(KEY_MONTH) || "2026-04"
}

export function setSelectedMonth(month: string): void {
  localStorage.setItem(KEY_MONTH, month)
}
