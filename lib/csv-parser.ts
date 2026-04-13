export interface ParsedDay {
  date: string
  ca_caisse: number
  ca_b2b: number
  ca_soir: number
  pct_soir: number
  tickets_count: number
  mouvement_caisse: number
}

function parseCSVLine(line: string, sep: string): string[] {
  const cols: string[] = []
  let current = ""
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === sep && !inQuotes) {
      cols.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  cols.push(current.trim())
  return cols
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")
}

function normalizeRow(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [normalize(key), value]))
}

function pick(row: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    if (alias in row) return row[alias]
  }
  return undefined
}

function parseNumericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  const normalized = String(value).trim().replace(/\s/g, "").replace(",", ".")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDateValue(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10)
  }

  const raw = String(value || "").trim()
  if (!raw) return ""

  const datePart = raw.split(/[ T]/)[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart

  const match = datePart.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/)
  if (!match) return ""

  const [, d, m, rawYear] = match
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
  return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
}

function parseHourValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.getHours()

  const raw = String(value).trim()
  const match = raw.match(/(?:^|\s)(\d{1,2}):\d{2}/)
  if (match) {
    const hour = Number(match[1])
    return Number.isFinite(hour) ? hour : null
  }

  const hour = Number(raw.split(":")[0])
  return Number.isFinite(hour) ? hour : null
}

export function parseSalesRows(rows: Record<string, unknown>[]): ParsedDay[] {
  if (rows.length === 0) throw new Error("Empty file")

  const normalizedRows = rows.map(normalizeRow)
  const firstRow = normalizedRows.find((row) => Object.keys(row).length > 0)
  if (!firstRow) throw new Error("Empty file")

  const hasDate = pick(firstRow, ["date"]) !== undefined
  const hasPrice = pick(firstRow, ["prixdevente"]) !== undefined
  if (!hasDate || !hasPrice) throw new Error("Format non reconnu")

  const grouped: Record<string, { cash: number; card: number; soir: number; mouvement: number; tickets: Set<string> }> = {}

  for (const row of normalizedRows) {
    const rawDate = pick(row, ["date"])
    const date = parseDateValue(rawDate)
    const hour = parseHourValue(pick(row, ["heure"]) ?? rawDate)
    const ticket = String(pick(row, ["numticket"]) || "").trim()
    const prix = parseNumericValue(pick(row, ["prixdevente"]))
    const qte = parseNumericValue(pick(row, ["quantite"])) ?? 1
    const rawPay = String(pick(row, ["moyensdepaiements", "moyensdepaiement"]) || "").toLowerCase()
    const rawType = normalize(String(pick(row, ["type", "typeligne", "typeticket", "typeoperation", "typedevente"]) || ""))
    const rawLib = normalize(String(pick(row, ["titreticket", "produit", "libellearticle", "nomarticle", "libelle", "designation"]) || ""))

    if (!date || prix === null || prix <= 0) continue
    const amount = prix * qte

    if (!grouped[date]) grouped[date] = { cash: 0, card: 0, soir: 0, mouvement: 0, tickets: new Set() }

    const isMouvement =
      rawType.includes("mouvement") ||
      rawLib.includes("mouvementdecaisse") ||
      rawLib.includes("fondsdecaisse") ||
      rawLib.includes("mouvementcaisse")

    if (isMouvement) {
      grouped[date].mouvement += amount
      continue
    }

    const isCash = rawPay.includes("esp") || rawPay.includes("cash")
    if (rawPay && isCash) {
      grouped[date].cash += amount
    } else {
      grouped[date].card += amount
    }

    if (ticket) grouped[date].tickets.add(ticket)

    if (hour !== null && hour >= 19) grouped[date].soir += amount
  }

  return Object.entries(grouped)
    .map(([date, { cash, card, soir, mouvement, tickets }]) => {
      const total = cash + card
      return {
        date,
        ca_caisse: Math.round(cash * 100) / 100,
        ca_b2b: Math.round(card * 100) / 100,
        ca_soir: Math.round(soir * 100) / 100,
        pct_soir: total > 0 ? (soir / total) * 100 : 0,
        tickets_count: tickets.size,
        mouvement_caisse: Math.round(mouvement * 100) / 100,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function parseCSV(content: string): ParsedDay[] {
  const sep = content.includes(";") ? ";" : ","
  const lines = content.split("\n").map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) throw new Error("Empty file")

  const headers = parseCSVLine(lines[0], sep)
  const rows = lines.slice(1).map((line) => {
    const cols = parseCSVLine(line, sep)
    return Object.fromEntries(headers.map((header, index) => [header, cols[index] ?? ""]))
  })

  return parseSalesRows(rows)
}
