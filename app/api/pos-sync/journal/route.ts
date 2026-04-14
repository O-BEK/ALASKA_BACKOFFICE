import { NextResponse } from "next/server"
import { parseCashJournalWorkbook } from "@/lib/pos-journal-parser"
import { archiveImportSource } from "@/lib/server/import-storage"
import { createClient, isAdmin } from "@/lib/supabase/server"

function toPosDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${m}/${d}/${y}`
}

type ExistingSale = {
  date: string
  ca_caisse: number | null
  ca_b2b: number | null
  ca_soir: number | null
  pct_soir: number | null
  tickets_count: number | null
  mouvement_caisse: number | null
  notes: string | null
  source: "manual" | "csv_import"
  import_id: string | null
  created_by: string | null
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const startDate = String(body?.startDate || "")
  const endDate = String(body?.endDate || "")

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate et endDate requis (YYYY-MM-DD)." }, { status: 400 })
  }

  const posUrl = process.env.POS_JOURNAL_API_URL
  const caisseId = process.env.POS_CAISSE_ID
  const token = process.env.POS_API_TOKEN

  if (!posUrl || !caisseId || !token) {
    return NextResponse.json({ error: "Variables POS_JOURNAL_API_URL, POS_CAISSE_ID, POS_API_TOKEN non configurées." }, { status: 500 })
  }

  const url = `${posUrl}?caisse=${caisseId}&startDate=${toPosDate(startDate)}&endDate=${toPosDate(endDate)}&token_api=${token}&idcaisselist=${caisseId}`

  let workbookBuffer: Buffer
  let filename: string

  try {
    const res = await fetch(url)
    if (!res.ok) {
      return NextResponse.json({ error: `Le POS a retourné une erreur HTTP ${res.status}.` }, { status: 502 })
    }
    workbookBuffer = Buffer.from(await res.arrayBuffer())
    const disposition = res.headers.get("content-disposition") || ""
    const match = disposition.match(/filename="([^"]+)"/)
    filename = match?.[1] ?? `journal_caisse_${startDate}_${endDate}.xls`
  } catch {
    return NextResponse.json({ error: "Impossible de joindre le serveur POS." }, { status: 502 })
  }

  let parsed: ReturnType<typeof parseCashJournalWorkbook>
  try {
    parsed = parseCashJournalWorkbook(workbookBuffer)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Format journal non reconnu."
    return NextResponse.json({ error: `Impossible de lire le journal POS. ${message}` }, { status: 400 })
  }

  if (parsed.length === 0) {
    return NextResponse.json({ error: "Aucune donnée trouvée dans le journal POS sur cette plage." }, { status: 400 })
  }

  const { data: existingSales, error: existingError } = await supabase
    .from("daily_sales")
    .select("date, ca_caisse, ca_b2b, ca_soir, pct_soir, tickets_count, mouvement_caisse, notes, source, import_id, created_by")

  if (existingError) {
    return NextResponse.json({ error: `Lecture des ventes impossible. ${existingError.message}` }, { status: 500 })
  }

  const existingByDate = new Map(((existingSales || []) as ExistingSale[]).map((sale) => [sale.date, sale]))
  const importedAt = new Date().toISOString()
  const anomalyCount = parsed.filter((row) => row.cash_journal_anomaly).length
  let storagePath: string

  try {
    storagePath = await archiveImportSource({
      importType: "cash_journal_xls",
      filename,
      body: workbookBuffer,
      contentType: "application/vnd.ms-excel",
      startDate,
      endDate,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue"
    return NextResponse.json({ error: `Archivage du fichier source impossible. ${message}` }, { status: 500 })
  }

  const { data: importRecord, error: importError } = await supabase
    .from("pos_imports")
    .insert({
      filename,
      storage_path: storagePath,
      import_type: "cash_journal_xls",
      imported_by: user.id,
      imported_at: importedAt,
      rows_processed: parsed.reduce((sum, row) => sum + row.cash_journal_sessions, 0),
      days_imported: parsed.length,
      date_range_start: parsed[0]?.date || null,
      date_range_end: parsed[parsed.length - 1]?.date || null,
      ca_total: parsed.reduce((sum, row) => sum + row.cash_sales_journal, 0),
      status: anomalyCount > 0 ? "partial" : "success",
    })
    .select("id")
    .single()

  if (importError) {
    return NextResponse.json({ error: `Impossible d'enregistrer l'import journal. ${importError.message}` }, { status: 500 })
  }

  const upsertRows = parsed.map((row) => {
    const existing = existingByDate.get(row.date)
    return {
      date: row.date,
      ca_caisse: existing?.ca_caisse ?? 0,
      ca_b2b: existing?.ca_b2b ?? 0,
      ca_soir: existing?.ca_soir ?? 0,
      pct_soir: existing?.pct_soir ?? 0,
      tickets_count: existing?.tickets_count ?? 0,
      mouvement_caisse: existing?.mouvement_caisse ?? 0,
      cash_sales_journal: row.cash_sales_journal,
      cash_movements_journal: row.cash_movements_journal,
      cash_opening_fund: row.cash_opening_fund,
      cash_closing_fund: row.cash_closing_fund,
      cash_journal_sessions: row.cash_journal_sessions,
      cash_journal_anomaly: row.cash_journal_anomaly,
      cash_journal_import_id: importRecord.id,
      notes: existing?.notes || "",
      source: existing?.source || "manual",
      import_id: existing?.import_id || null,
      created_by: existing?.created_by || user.id,
      updated_at: importedAt,
    }
  })

  const { error: upsertError } = await supabase.from("daily_sales").upsert(upsertRows, { onConflict: "date" })
  if (upsertError) {
    return NextResponse.json({ error: `Upsert journal impossible. ${upsertError.message}` }, { status: 500 })
  }

  return NextResponse.json({
    days_imported: parsed.length,
    cash_sales_total: parsed.reduce((sum, row) => sum + row.cash_sales_journal, 0),
    cash_movements_total: parsed.reduce((sum, row) => sum + row.cash_movements_journal, 0),
    anomalies: anomalyCount,
    filename,
    storage_path: storagePath,
    date_range_start: parsed[0]?.date,
    date_range_end: parsed[parsed.length - 1]?.date,
  })
}
