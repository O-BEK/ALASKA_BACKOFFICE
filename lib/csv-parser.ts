interface ParsedDay {
  date: string
  ca_caisse: number
  ca_soir: number
  pct_soir: number
  tickets_count: number
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

export function parseCSV(content: string): ParsedDay[] {
  const sep = content.includes(";") ? ";" : ","
  const lines = content.split("\n").map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) throw new Error("Empty file")

  // Detect column indices from header
  const headers = parseCSVLine(lines[0], sep).map(normalize)
  const dateIdx      = headers.indexOf("date")
  const heureIdx     = headers.indexOf("heure")
  const ticketIdx    = headers.findIndex(h => h === "numticket")
  const prixIdx      = headers.findIndex(h => h === "prixdevente")
  const qteIdx       = headers.findIndex(h => h === "quantite")

  if (dateIdx === -1 || prixIdx === -1) throw new Error("Format non reconnu")

  const grouped: Record<string, { total: number; soir: number; tickets: Set<string> }> = {}

  for (const line of lines.slice(1)) {
    const cols = parseCSVLine(line, sep)
    if (cols.length <= prixIdx) continue

    const rawDate   = cols[dateIdx]?.trim()
    const rawTime   = heureIdx >= 0 ? cols[heureIdx]?.trim() : ""
    const ticket    = ticketIdx >= 0 ? cols[ticketIdx]?.trim() : ""
    const rawPrix   = cols[prixIdx]?.trim().replace(",", ".")
    const rawQte    = qteIdx >= 0 ? cols[qteIdx]?.trim().replace(",", ".") : "1"

    if (!rawDate || !rawPrix) continue
    const prix = parseFloat(rawPrix)
    const qte  = parseFloat(rawQte) || 1
    if (isNaN(prix) || prix <= 0) continue

    const amount = prix * qte

    // Date: DD/MM/YYYY → YYYY-MM-DD
    let date: string
    if (rawDate.includes("/")) {
      const [d, m, y] = rawDate.split("/")
      if (!d || !m || !y) continue
      date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
    } else {
      date = rawDate
    }

    if (!grouped[date]) grouped[date] = { total: 0, soir: 0, tickets: new Set() }
    grouped[date].total += amount
    if (ticket) grouped[date].tickets.add(ticket)

    // Soir = heure >= 19:00
    if (rawTime) {
      const hour = parseInt(rawTime.split(":")[0])
      if (!isNaN(hour) && hour >= 19) grouped[date].soir += amount
    }
  }

  return Object.entries(grouped)
    .map(([date, { total, soir, tickets }]) => ({
      date,
      ca_caisse:    Math.round(total * 100) / 100,
      ca_soir:      Math.round(soir * 100) / 100,
      pct_soir:     total > 0 ? (soir / total) * 100 : 0,
      tickets_count: tickets.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
