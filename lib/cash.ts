import type { DailyEntry } from "@/lib/types"
import type { DailySaleRecord } from "@/lib/server/db-types"

type CashSource = Pick<
  DailyEntry,
  | "ca_caisse"
  | "ca_b2b"
  | "mouvement_caisse"
  | "cash_sales_journal"
  | "cash_movements_journal"
  | "cash_journal_sessions"
  | "cash_journal_anomaly"
  | "cash_journal_import_id"
> | Pick<
  DailySaleRecord,
  | "ca_caisse"
  | "ca_b2b"
  | "mouvement_caisse"
  | "cash_sales_journal"
  | "cash_movements_journal"
  | "cash_journal_sessions"
  | "cash_journal_anomaly"
  | "cash_journal_import_id"
>

export function hasCashJournal(entry: CashSource | null | undefined) {
  if (!entry) return false
  return Boolean(entry.cash_journal_import_id) || (entry.cash_journal_sessions ?? 0) > 0 || entry.cash_sales_journal !== null || entry.cash_movements_journal !== null
}

export function getCashSalesReference(entry: CashSource | null | undefined) {
  if (!entry) return 0
  return hasCashJournal(entry) ? Number(entry.cash_sales_journal || 0) : Number(entry.ca_caisse || 0)
}

export function getCashMovementsReference(entry: CashSource | null | undefined) {
  if (!entry) return 0
  return hasCashJournal(entry) ? Number(entry.cash_movements_journal || 0) : Number(entry.mouvement_caisse || 0)
}

export function getCashEnvelope(entry: CashSource | null | undefined, achatsCash: number) {
  return getCashSalesReference(entry) + getCashMovementsReference(entry) - achatsCash
}

export function getGlobalIndicativeCA(entry: CashSource | null | undefined) {
  if (!entry) return 0
  return Number(entry.ca_caisse || 0) + Number(entry.ca_b2b || 0)
}
