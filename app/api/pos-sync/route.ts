import { NextResponse } from "next/server"
import { parseCSV } from "@/lib/csv-parser"
import { createClient, isAdmin } from "@/lib/supabase/server"

// Convert YYYY-MM-DD → MM/DD/YYYY for POS API
function toPosDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${m}/${d}/${y}`
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

  // Fetch CSV from POS
  const url = `${posUrl}?caisse=${caisseId}&startDate=${toPosDate(startDate)}&endDate=${toPosDate(endDate)}&token_api=${token}&idcaisselist=${caisseId}`

  let csvText: string
  let filename: string
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return NextResponse.json({ error: `Le POS a retourné une erreur HTTP ${res.status}.` }, { status: 502 })
    }
    csvText = await res.text()
    const disposition = res.headers.get("content-disposition") || ""
    const match = disposition.match(/filename="([^"]+)"/)
    filename = match?.[1] ?? `pos_sync_${startDate}_${endDate}.csv`
  } catch {
    return NextResponse.json({ error: "Impossible de joindre le serveur POS." }, { status: 502 })
  }

  // Parse CSV
  let parsed: ReturnType<typeof parseCSV>
  try {
    parsed = parseCSV(csvText)
  } catch {
    return NextResponse.json({ error: "Format CSV non reconnu dans la réponse POS." }, { status: 400 })
  }

  if (parsed.length === 0) {
    return NextResponse.json({ error: "Aucune donnée trouvée dans la plage de dates." }, { status: 400 })
  }

  // Read existing sales to preserve notes
  const { data: existingSales, error: salesErr } = await supabase
    .from("daily_sales")
    .select("date, notes, created_by")
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
      imported_by: user.id,
      imported_at: importedAt,
      rows_processed: parsed.reduce((sum, row) => sum + row.tickets_count, 0),
      days_imported: parsed.length,
      date_range_start: parsed[0]?.date || null,
      date_range_end: parsed[parsed.length - 1]?.date || null,
      ca_total: parsed.reduce((sum, row) => sum + row.ca_caisse + row.ca_b2b, 0),
      status: "success",
    })
    .select("id, filename, imported_at, rows_processed, days_imported, date_range_start, date_range_end, ca_total, status")
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
      notes: (existing as any)?.notes || "",
      source: "csv_import",
      import_id: importRecord?.id || null,
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
