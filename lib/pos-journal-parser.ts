import * as XLSX from "xlsx"

export interface ParsedCashJournalDay {
  date: string
  cash_sales_journal: number
  cash_movements_journal: number
  cash_opening_fund: number | null
  cash_closing_fund: number | null
  cash_journal_sessions: number
  cash_journal_anomaly: boolean
}

type JournalRow = {
  openingDate: string
  closingDate: string
  openingFund: number | null
  closingFund: number | null
  cashSales: number
  cashMovements: number
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  const normalized = String(value).replace(/\s/g, "").replace(",", ".")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDateKey(value: unknown): string {
  const raw = String(value || "").trim()
  if (!raw) return ""
  const datePart = raw.split(" ")[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart
  const match = datePart.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/)
  if (!match) return ""
  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

function parseTimeValue(value: unknown) {
  const raw = String(value || "").trim()
  if (!raw) return ""
  const parts = raw.split(" ")
  return parts[1] || ""
}

function normalizeRows(rows: Record<string, unknown>[]): JournalRow[] {
  return rows
    .map((row) => {
      const openingDate = parseDateKey(row["DATE OUVERTURE"])
      const closingDate = parseDateKey(row["DATE FERMETURE"])
      const date = closingDate || openingDate
      if (!date) return null

      return {
        openingDate: `${openingDate} ${parseTimeValue(row["DATE OUVERTURE"])}`.trim(),
        closingDate: `${closingDate} ${parseTimeValue(row["DATE FERMETURE"])}`.trim(),
        openingFund: parseNumber(row["FOND DE CAISSE OUVERTURE"]),
        closingFund: parseNumber(row["FOND DE CAISSE CONSTATÉ"]),
        cashSales: parseNumber(row["VENTES EN ESPÈCES"]) || 0,
        cashMovements: parseNumber(row["MOUVEMENTS DE CAISSE"]) || 0,
      }
    })
    .filter((row): row is JournalRow => !!row)
}

export function parseCashJournalRows(rows: Record<string, unknown>[]): ParsedCashJournalDay[] {
  const normalized = normalizeRows(rows)
  const byDate = normalized.reduce<Record<string, JournalRow[]>>((acc, row) => {
    const date = row.closingDate.slice(0, 10) || row.openingDate.slice(0, 10)
    if (!acc[date]) acc[date] = []
    acc[date].push(row)
    return acc
  }, {})

  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sessions]) => {
      const ordered = sessions.sort((a, b) => {
        const left = a.openingDate || a.closingDate
        const right = b.openingDate || b.closingDate
        return left.localeCompare(right)
      })
      const cashSales = ordered.reduce((sum, row) => sum + row.cashSales, 0)
      const cashMovements = ordered.reduce((sum, row) => sum + row.cashMovements, 0)
      const openingFund = ordered.find((row) => row.openingFund !== null)?.openingFund ?? null
      const closingCandidates = ordered.filter((row) => row.closingFund !== null)
      const closingNonZero = closingCandidates.filter((row) => row.closingFund && Math.abs(row.closingFund) > 0)
      const closingFund = (closingNonZero.at(-1) ?? closingCandidates.at(-1))?.closingFund ?? null
      const expectedClosing =
        openingFund === null ? null : Math.round((openingFund + cashSales + cashMovements) * 100) / 100
      const mismatch =
        expectedClosing !== null && closingFund !== null ? Math.abs(expectedClosing - closingFund) > 1 : false
      const anomaly = ordered.length > 1 || mismatch || closingFund === null

      return {
        date,
        cash_sales_journal: Math.round(cashSales * 100) / 100,
        cash_movements_journal: Math.round(cashMovements * 100) / 100,
        cash_opening_fund: openingFund === null ? null : Math.round(openingFund * 100) / 100,
        cash_closing_fund: closingFund === null ? null : Math.round(closingFund * 100) / 100,
        cash_journal_sessions: ordered.length,
        cash_journal_anomaly: anomaly,
      }
    })
}

export function parseCashJournalWorkbook(input: Buffer | ArrayBuffer | Uint8Array): ParsedCashJournalDay[] {
  const workbook = XLSX.read(input, { type: "buffer" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error("Feuille journal introuvable.")
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: null })
  return parseCashJournalRows(rows)
}
