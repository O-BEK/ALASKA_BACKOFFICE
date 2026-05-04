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

function stripLeadingDate(label: string): string {
  return label.replace(/^\d{2}\/\d{2}\/\d{4}\s+/, "").trim()
}

function cleanLabel(label: string): string {
  return stripLeadingDate(label)
    .replace(/^\d{6,}\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
}

function looksLikeAmount(raw: string): boolean {
  return /^[+-]?\s*\d[\d\s.,]*$/.test(raw.trim())
}

function inferUnsignedMovementSide(label: string): "debit" | "credit" {
  const normalized = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  if (
    normalized.includes("frais") ||
    normalized.includes("prelevement") ||
    normalized.includes("emis") ||
    normalized.includes("debit") ||
    normalized.includes("achat")
  ) {
    return "debit"
  }

  return "credit"
}

function parseSplitParts(line: string): BankTransaction | null {
  const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})\s{2,}/)
  if (!dateMatch) return null
  const date = parseDate(dateMatch[1])
  if (!date) return null

  const parts = line
    .slice(dateMatch[0].length)
    .split(/\s{2,}/)
    .map((part) => part.trim())

  const nonEmpty = parts.filter(Boolean)
  if (nonEmpty.length < 2) return null

  const amountParts: string[] = []
  const labelParts = [...nonEmpty]
  while (labelParts.length > 1 && looksLikeAmount(labelParts[labelParts.length - 1]) && amountParts.length < 3) {
    amountParts.unshift(labelParts.pop()!)
  }

  if (amountParts.length < 2) return null

  const label = cleanLabel(labelParts.join(" "))
  if (!label) return null

  const balance = parseMadAmount(amountParts[amountParts.length - 1])
  let debit = 0
  let credit = 0

  if (amountParts.length === 2) {
    const mouvement = parseMadAmount(amountParts[0])
    if (amountParts[0].trim().startsWith("-")) {
      debit = Math.abs(mouvement)
    } else if (amountParts[0].trim().startsWith("+")) {
      credit = mouvement
    } else if (inferUnsignedMovementSide(label) === "debit") {
      debit = mouvement
    } else {
      credit = mouvement
    }
  } else {
    debit = parseMadAmount(amountParts[0])
    credit = parseMadAmount(amountParts[1])
  }

  return { date, label, debit, credit, balance }
}

function parseByDecimalAmounts(line: string): BankTransaction | null {
  const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+/)
  if (!dateMatch) return null
  const date = parseDate(dateMatch[1])
  if (!date) return null

  const rest = line.slice(dateMatch[0].length)
  const amountMatches = Array.from(rest.matchAll(/[+-]?\s*(?:\d{1,3}(?:[ ,.]\d{3})+|\d+)[,.]\d{2}/g))
  if (amountMatches.length < 2) return null

  const movementMatch = amountMatches[amountMatches.length - 2]
  const balanceMatch = amountMatches[amountMatches.length - 1]
  const label = cleanLabel(rest.slice(0, movementMatch.index).trim())
  if (!label) return null

  const movementRaw = movementMatch[0]
  const mouvement = parseMadAmount(movementRaw)
  const balance = parseMadAmount(balanceMatch[0])
  let debit = 0
  let credit = 0

  if (movementRaw.trim().startsWith("-")) {
    debit = Math.abs(mouvement)
  } else if (movementRaw.trim().startsWith("+")) {
    credit = mouvement
  } else if (inferUnsignedMovementSide(label) === "debit") {
    debit = mouvement
  } else {
    credit = mouvement
  }

  return { date, label, debit, credit, balance }
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
    const decimalTx = parseByDecimalAmounts(line)
    if (decimalTx) {
      transactions.push(decimalTx)
      continue
    }

    const splitTx = parseSplitParts(line)
    if (splitTx) {
      transactions.push(splitTx)
      continue
    }

    // Try signed format first
    let match = line.match(TX_LINE_SIGNED)
    if (match) {
      const date = parseDate(match[1])
      if (!date) continue
      const label = cleanLabel(match[2].trim())
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
      const label = cleanLabel(match[2].trim())
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
