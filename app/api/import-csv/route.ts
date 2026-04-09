import { NextResponse } from "next/server"
import { parseCSV } from "@/lib/csv-parser"
import { createClient } from "@/lib/supabase/server"
import type { ImportRecord } from "@/lib/types"

type ParsedDay = {
  date: string
  ca_caisse: number
  ca_soir: number
  pct_soir: number
  tickets_count: number
}

function sanitizeParsedRows(input: unknown): ParsedDay[] {
  if (!Array.isArray(input)) return []

  return input
    .map((row) => {
      if (!row || typeof row !== "object") return null
      const candidate = row as Record<string, unknown>
      const date = typeof candidate.date === "string" ? candidate.date : ""
      if (!date) return null

      return {
        date,
        ca_caisse: Number(candidate.ca_caisse || 0),
        ca_soir: Number(candidate.ca_soir || 0),
        pct_soir: Number(candidate.pct_soir || 0),
        tickets_count: Number(candidate.tickets_count || 0),
      }
    })
    .filter((row): row is ParsedDay => !!row)
}

function isMissingPosImportsTable(error: { message?: string } | null | undefined) {
  const message = error?.message || ""
  return message.includes("Could not find the table 'public.pos_imports'") || message.includes('relation "public.pos_imports" does not exist')
}

export async function GET() {
  const supabase = createClient()

  try {
    const result = await supabase
      .from("pos_imports")
      .select("id, filename, imported_at, rows_processed, days_imported, date_range_start, date_range_end, ca_total, status")
      .order("imported_at", { ascending: false })

    if (isMissingPosImportsTable(result.error)) {
      return NextResponse.json({ history: [] })
    }

    if (result.error) {
      return NextResponse.json({ error: `Impossible de charger l'historique d'import. ${result.error.message}` }, { status: 500 })
    }

    return NextResponse.json({ history: result.data || [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur inconnue."
    return NextResponse.json({ error: `Impossible de charger l'historique d'import. ${message}` }, { status: 500 })
  }
}

type ExistingSale = {
  date: string
  ca_caisse: number | null
  ca_b2b: number | null
  notes: string | null
  created_by: string | null
}

async function readExistingSales(supabase: ReturnType<typeof createClient>) {
  const result = await supabase
    .from("daily_sales")
    .select("date, ca_caisse, ca_b2b, notes, created_by")

  if (result.error) {
    throw new Error(result.error.message)
  }

  return (result.data || []) as ExistingSale[]
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const content = String(body?.content || "")
  const filename = String(body?.filename || "import.csv")
  const parsedFromBody = sanitizeParsedRows(body?.parsed)

  if (!content && parsedFromBody.length === 0) {
    return NextResponse.json({ error: "Contenu CSV requis." }, { status: 400 })
  }

  let parsed: ParsedDay[]

  try {
    parsed = parsedFromBody.length > 0 ? parsedFromBody : parseCSV(content)
  } catch {
    return NextResponse.json(
      { error: "Format CSV non reconnu. Vérifiez que c'est bien un export caisse valide." },
      { status: 400 }
    )
  }

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: "Format CSV non reconnu. Vérifiez que c'est bien un export caisse valide." },
      { status: 400 }
    )
  }

  try {
    const existingSales = await readExistingSales(supabase)
    const existingSalesByDate = new Map(existingSales.map((item) => [item.date, item]))
    const existingDates = new Set(existingSales.map((item) => item.date))
    const duplicates = parsed.filter((row) => existingDates.has(row.date)).map((row) => row.date)

    if (body?.commit !== true) {
      return NextResponse.json({ parsed, duplicates, rowsIgnored: 0 })
    }

    const importedAt = new Date().toISOString()
    const importInsertResult = await supabase
      .from("pos_imports")
      .insert({
        filename,
        imported_by: user.id,
        imported_at: importedAt,
        rows_processed: parsed.reduce((sum, row) => sum + row.tickets_count, 0),
        days_imported: parsed.length,
        date_range_start: parsed[0]?.date || null,
        date_range_end: parsed[parsed.length - 1]?.date || null,
        ca_total: parsed.reduce((sum, row) => sum + row.ca_caisse, 0),
        status: duplicates.length > 0 ? "partial" : "success",
      })
      .select("id, filename, imported_at, rows_processed, days_imported, date_range_start, date_range_end, ca_total, status")
      .single()

    if (importInsertResult.error && !isMissingPosImportsTable(importInsertResult.error)) {
      return NextResponse.json(
        { error: `Impossible d'enregistrer l'import. ${importInsertResult.error.message}` },
        { status: 500 }
      )
    }

    const importRecord: ImportRecord = importInsertResult.data || {
      id: `legacy-${Date.now()}`,
      filename,
      imported_at: importedAt,
      rows_processed: parsed.reduce((sum, row) => sum + row.tickets_count, 0),
      days_imported: parsed.length,
      date_range_start: parsed[0]?.date || "",
      date_range_end: parsed[parsed.length - 1]?.date || "",
      ca_total: parsed.reduce((sum, row) => sum + row.ca_caisse, 0),
      status: duplicates.length > 0 ? "partial" : "success",
    }

    const upsertRows = parsed.map((row) => {
      const existing = existingSalesByDate.get(row.date)
      return {
        date: row.date,
        ca_caisse: existing?.ca_caisse || 0,
        ca_b2b: existing?.ca_b2b || 0,
        ca_soir: row.ca_soir,
        pct_soir: row.pct_soir,
        tickets_count: row.tickets_count,
        notes: existing?.notes || "",
        source: "csv_import",
        import_id: importInsertResult.data?.id || null,
        created_by: existing?.created_by || user.id,
        updated_at: importedAt,
      }
    })

    const salesResult = await supabase.from("daily_sales").upsert(upsertRows, { onConflict: "date" })
    if (salesResult.error) {
      return NextResponse.json(
        { error: `Impossible de mettre à jour les ventes importées. ${salesResult.error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      parsed,
      duplicates,
      result: importRecord,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur inconnue."
    return NextResponse.json({ error: `Import impossible. ${message}` }, { status: 500 })
  }
}
