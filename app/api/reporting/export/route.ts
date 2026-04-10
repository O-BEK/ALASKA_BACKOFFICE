import { NextResponse } from "next/server"
import { buildMonthlyExportRows } from "@/lib/server/analytics"
import { createClient } from "@/lib/supabase/server"
import { readSnapshot } from "@/lib/server/supabase-store"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7)
  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const db = await readSnapshot(supabase)
    const rows = buildMonthlyExportRows(db, month)
    const csv = [
      "Date,CA Caisse,Total Dépenses,MP,RH,CHARGES,AUTRE",
      ...rows.map((row) => `${row.date},${row.ca_caisse},${row.total_expenses},${row.MP},${row.RH},${row.CHARGES},${row.AUTRE}`),
    ].join("\n")

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"alaska_${month}.csv\"`,
      },
    })
  } catch {
    return NextResponse.json({ error: "Impossible d'exporter le reporting." }, { status: 500 })
  }
}
