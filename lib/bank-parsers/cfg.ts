import type { BankTransaction, ParsedStatement } from "./types"

/**
 * Parses a MAD-formatted amount string, preserving sign.
 * Supports both formats:
 *   - Anglo (comma=thousands, dot=decimal): "5,000.00" → 5000
 *   - European (dot=thousands, comma=decimal): "5.000,00" → 5000
 * Also handles signed values: "+4,500.00" → 4500, "-3,000.00" → -3000
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
 * CFG Bank signed format: DATE  LABEL  [+|-]MOUVEMENT  BALANCE
 * The movement amount carries a sign: positive = credit, negative = debit.
 */
const TX_LINE_SIGNED = /^(\d{2}\/\d{2}\/\d{4})\s{2,}(.+?)\s{2,}([+-]?[\d,. ]+)\s{2,}([\d,. ]+)$/

/**
 * CFG Bank split format: DATE  LABEL  DEBIT  CREDIT  BALANCE
 * Separate debit and credit columns (one may be empty).
 */
const TX_LINE_SPLIT =
  /^(\d{2}\/\d{2}\/\d{4})\s{2,}(.+?)\s{2,}([\d,. ]*)\s{2,}([\d,. ]*)\s{2,}([\d,. ]+)$/

export function parseCfg(text: string): ParsedStatement {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const transactions: BankTransaction[] = []

  for (const line of lines) {
    // Try signed format first
    let match = line.match(TX_LINE_SIGNED)
    if (match) {
      const date = parseDate(match[1])
      if (!date) continue
      const label = match[2].trim()
      if (!label) continue
      const mouvement = parseMadAmount(match[3]) // preserves sign (+/-)
      const balance = parseMadAmount(match[4])
      const debit = mouvement < 0 ? Math.abs(mouvement) : 0
      const credit = mouvement >= 0 ? mouvement : 0
      transactions.push({ date, label, debit, credit, balance })
      continue
    }

    // Try split debit/credit format
    match = line.match(TX_LINE_SPLIT)
    if (match) {
      const date = parseDate(match[1])
      if (!date) continue
      const label = match[2].trim()
      if (!label) continue
      const debit = parseMadAmount(match[3] ?? "")
      const credit = parseMadAmount(match[4] ?? "")
      const balance = parseMadAmount(match[5] ?? "")
      transactions.push({ date, label, debit, credit, balance })
    }
  }

  const dates = transactions.map((t) => t.date).sort()
  return {
    bank: "cfg",
    period_start: dates[0] ?? "",
    period_end: dates[dates.length - 1] ?? "",
    transactions,
  }
}
