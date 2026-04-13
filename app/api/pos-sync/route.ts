import { NextResponse } from "next/server"
import { parseCSV, type ParsedDay } from "@/lib/csv-parser"
import { parseSalesWorkbook } from "@/lib/sales-workbook-parser"
import { createClient, isAdmin } from "@/lib/supabase/server"

// Convert YYYY-MM-DD → MM/DD/YYYY for POS API
function toPosDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${m}/${d}/${y}`
}

function getFilename(disposition: string, fallback: string) {
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].replace(/"/g, ""))

  const quotedMatch = disposition.match(/filename="([^"]+)"/i)
  if (quotedMatch?.[1]) return quotedMatch[1]

  const plainMatch = disposition.match(/filename=([^;]+)/i)
  return plainMatch?.[1]?.trim().replace(/^"|"$/g, "") || fallback
}

function looksLikeWorkbook(body: ArrayBuffer, contentType: string, filename: string) {
  const lowerType = contentType.toLowerCase()
  const lowerName = filename.toLowerCase()
  const bytes = new Uint8Array(body)
  const isZipWorkbook = bytes[0] === 0x50 && bytes[1] === 0x4b
  const isOleWorkbook = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0

  return (
    lowerType.includes("spreadsheet") ||
    lowerType.includes("excel") ||
    lowerType.includes("vnd.ms-excel") ||
    lowerName.endsWith(".xls") ||
    lowerName.endsWith(".xlsx") ||
    isZipWorkbook ||
    isOleWorkbook
  )
}

function decodeText(body: ArrayBuffer) {
  const bytes = new Uint8Array(body)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes)
  return new TextDecoder("utf-8").decode(bytes)
}

function parseSalesExport(body: ArrayBuffer, contentType: string, filename: string): ParsedDay[] {
  const shouldTryWorkbookFirst = looksLikeWorkbook(body, contentType, filename)
  const parsers = shouldTryWorkbookFirst
    ? [
        () => parseSalesWorkbook(Buffer.from(body)),
        () => parseCSV(decodeText(body)),
      ]
    : [
        () => parseCSV(decodeText(body)),
        () => parseSalesWorkbook(Buffer.from(body)),
      ]

  let lastError: unknown = null
  for (const parse of parsers) {
    try {
      const parsed = parse()
      if (parsed.length > 0) return parsed
    } catch (error) {
      lastError = error
    }
  }

  if (lastError instanceof Error) throw lastError
  throw new Error("Format POS non reconnu")
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const startDate = String(body?.startDate || "")
  const endDate = String(body?.endDate || "")

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate et endDate requis (YYYY-MM-DD)." }, { status: 400 })
  }

  const posUrl = process.env.POS_API_URL
  const caisseId = process.env.POS_CAISSE_ID
  const token = process.env.POS_API_TOKEN

  if (!posUrl || !caisseId || !token) {
    return NextResponse.json({ error: "Variables POS_API_URL, POS_CAISSE_ID, POS_API_TOKEN non configurées." }, { status: 500 })
  }

  // Fetch sales export from POS. The POS can return CSV or Excel depending on date range.
  const url = `${posUrl}?caisse=${caisseId}&startDate=${toPosDate(startDate)}&endDate=${toPosDate(endDate)}&token_api=${token}&idcaisselist=${caisseId}`

  let exportBody: ArrayBuffer
  let contentType: string
  let filename: string
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return NextResponse.json({ error: `Le POS a retourné une erreur HTTP ${res.status}.` }, { status: 502 })
    }
    exportBody = await res.arrayBuffer()
    contentType = res.headers.get("content-type") || ""
    const disposition = res.headers.get("content-disposition") || ""
    filename = getFilename(disposition, `pos_sync_${startDate}_${endDate}.csv`)
  } catch {
    return NextResponse.json({ error: "Impossible de joindre le serveur POS." }, { status: 502 })
  }

  // Parse CSV or Excel sales export
  let parsed: ParsedDay[]
  try {
    parsed = parseSalesExport(exportBody, contentType, filename)
  } catch {
    return NextResponse.json({ error: "Format ventes POS non reconnu dans la réponse POS." }, { status: 400 })
  }

  if (parsed.length === 0) {
    return NextResponse.json({ error: "Aucune donnée trouvée dans la plage de dates." }, { status: 400 })
  }

  // Read existing sales to preserve notes
  const { data: existingSales, error: salesErr } = await supabase
    .from("daily_sales")
    .select("date, notes, created_by, cash_sales_journal, cash_movements_journal, cash_opening_fund, cash_closing_fund, cash_journal_sessions, cash_journal_anomaly, cash_journal_import_id")
  if (salesErr) {
    return NextResponse.json({ error: `Lecture des ventes impossible. ${salesErr.message}` }, { status: 500 })
  }

  const existingByDate = new Map((existingSales || []).map((s: any) => [s.date, s]))
  const importedAt = new Date().toISOString()

  // Insert pos_imports record
  const { data: importRecord } = await supabase
    .from("pos_imports")
    .insert({
      filename,
      import_type: "sales_csv",
      imported_by: user.id,
      imported_at: importedAt,
      rows_processed: parsed.reduce((sum, row) => sum + row.tickets_count, 0),
      days_imported: parsed.length,
      date_range_start: parsed[0]?.date || null,
      date_range_end: parsed[parsed.length - 1]?.date || null,
      ca_total: parsed.reduce((sum, row) => sum + row.ca_caisse + row.ca_b2b, 0),
      status: "success",
    })
    .select("id, filename, import_type, imported_at, rows_processed, days_imported, date_range_start, date_range_end, ca_total, status")
    .single()

  // Upsert daily_sales
  const upsertRows = parsed.map((row) => {
    const existing = existingByDate.get(row.date)
    return {
      date: row.date,
      ca_caisse: row.ca_caisse,
      ca_b2b: row.ca_b2b ?? 0,
      ca_soir: row.ca_soir,
      pct_soir: row.pct_soir,
      tickets_count: row.tickets_count,
      mouvement_caisse: row.mouvement_caisse ?? 0,
      notes: (existing as any)?.notes || "",
      source: "csv_import",
      import_id: importRecord?.id || null,
      cash_sales_journal: (existing as any)?.cash_sales_journal ?? null,
      cash_movements_journal: (existing as any)?.cash_movements_journal ?? null,
      cash_opening_fund: (existing as any)?.cash_opening_fund ?? null,
      cash_closing_fund: (existing as any)?.cash_closing_fund ?? null,
      cash_journal_sessions: (existing as any)?.cash_journal_sessions ?? 0,
      cash_journal_anomaly: (existing as any)?.cash_journal_anomaly ?? false,
      cash_journal_import_id: (existing as any)?.cash_journal_import_id ?? null,
      created_by: (existing as any)?.created_by || user.id,
      updated_at: importedAt,
    }
  })

  const { error: upsertErr } = await supabase.from("daily_sales").upsert(upsertRows, { onConflict: "date" })
  if (upsertErr) {
    return NextResponse.json({ error: `Upsert ventes impossible. ${upsertErr.message}` }, { status: 500 })
  }

  return NextResponse.json({
    days_imported: parsed.length,
    ca_total: parsed.reduce((sum, row) => sum + row.ca_caisse + row.ca_b2b, 0),
    filename,
    date_range_start: parsed[0]?.date,
    date_range_end: parsed[parsed.length - 1]?.date,
  })
}
