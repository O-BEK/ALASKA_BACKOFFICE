import type { BankTransaction, ParsedStatement } from "./types"

/**
 * Parses a MAD-formatted amount string.
 * Supports both formats:
 *   - Anglo (comma=thousands, dot=decimal): "5,000.00" → 5000
 *   - European (dot=thousands, comma=decimal): "5.000,00" → 5000
 */
function parseMadAmount(raw: string): number {
  if (!raw || raw.trim() === "") return 0
  const s = raw.trim().replace(/\s/g, "")
  // Remove comma-as-thousands-separator (comma followed by 3 digits then dot or end)
  const noCommaThousands = s.replace(/,(?=\d{3}(\.|$))/g, "")
  // Remove dot-as-thousands-separator (dot followed by 3 digits then comma)
  const noThousands = noCommaThousands.replace(/\.(?=\d{3},)/g, "")
  // Replace remaining comma (decimal separator) with dot
  const normalized = noThousands.replace(",", ".")
  const value = parseFloat(normalized)
  return isNaN(value) ? 0 : value
}

function parseDate(raw: string): string | null {
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  return `${match[3]}-${match[2]}-${match[1]}`
}

/**
 * Column-position threshold (chars after date prefix) to distinguish debit vs credit.
 * In BP statements, the debit column appears at ~40-45 chars and the credit column
 * at ~50-55 chars from the start of the rest of the line (after date + spaces).
 */
const DEBIT_COL_THRESHOLD = 48

function parseLine(line: string): BankTransaction | null {
  const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})\s{2,}/)
  if (!dateMatch) return null

  const date = parseDate(dateMatch[1])
  if (!date) return null

  const afterDate = line.slice(dateMatch[0].length)

  // Find the position of the first digit to distinguish debit (closer) vs credit (farther)
  const firstDigitPos = afterDate.search(/\d/)

  // Split on 2+ consecutive spaces; filter out empty parts
  const parts = afterDate.split(/\s{2,}/).map((p) => p.trim()).filter((p) => p !== "")

  if (parts.length < 2) return null

  const label = parts[0]
  if (!label) return null

  const balance = parseMadAmount(parts[parts.length - 1])
  let debit = 0
  let credit = 0

  if (parts.length >= 3) {
    // There is an explicit amount column between label and balance
    const amt = parseMadAmount(parts[1])
    if (firstDigitPos < DEBIT_COL_THRESHOLD) {
      debit = amt
    } else {
      credit = amt
    }
  }
  // parts.length === 2: only label + balance, no debit/credit (e.g. opening balance line)

  return { date, label, debit, credit, balance }
}

export function parseBanquePopulaire(text: string): ParsedStatement {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const transactions: BankTransaction[] = []

  for (const line of lines) {
    const tx = parseLine(line)
    if (tx) transactions.push(tx)
  }

  const dates = transactions.map((t) => t.date).sort()
  return {
    bank: "bp",
    period_start: dates[0] ?? "",
    period_end: dates[dates.length - 1] ?? "",
    transactions,
  }
}
