import { NextResponse } from "next/server"
import { buildExpenseExportRows, buildMonthlyExportRows, buildYearComparisonRows } from "@/lib/server/analytics"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { readSnapshot } from "@/lib/server/supabase-store"

function csvCell(value: unknown) {
  const text = String(value ?? "")
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`
  }
  return text
}

function buildCsv(rows: unknown[][]) {
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\n")
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7)
  const year = Number(searchParams.get("year") || month.slice(0, 4))
  const type = searchParams.get("type") || "monthly"
  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 })
    }
    if (!(await isAdmin(supabase, user.id))) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
    }
    const db = await readSnapshot(supabase)
    let filename = `alaska_reporting_${month}.csv`
    let rows: unknown[][]

    if (type === "expenses") {
      const expenseRows = buildExpenseExportRows(db, month)
      filename = `alaska_depenses_${month}.csv`
      rows = [
        ["Date", "Jour", "Catégorie", "Poste", "Montant", "Notes"],
        ...expenseRows.map((row) => [row.date, row.day, row.category, row.label, row.amount, row.notes]),
      ]
    } else if (type === "comparison") {
      const comparisonRows = buildYearComparisonRows(db, year)
      filename = `alaska_comparaison_${year}.csv`
      rows = [
        ["Mois", `${year - 1}`, `${year}`, "Delta %"],
        ...comparisonRows.map((row) => [row.month, row.previous, row.current, row.delta_pct === null ? "" : row.delta_pct.toFixed(1)]),
      ]
    } else {
      const monthlyRows = buildMonthlyExportRows(db, month)
      rows = [
        ["Date", "CA Caisse", "CA B2B", "CA Total", "CA Soir", "Part Soir %", "Source", "Notes", "Total Dépenses", "MP", "RH", "CHARGES", "AUTRE"],
        ...monthlyRows.map((row) => [
          row.date,
          row.ca_caisse,
          row.ca_b2b,
          row.ca_total,
          row.ca_soir,
          row.pct_soir.toFixed(1),
          row.source,
          row.notes,
          row.total_expenses,
          row.MP,
          row.RH,
          row.CHARGES,
          row.AUTRE,
        ]),
      ]
    }

    const csv = buildCsv(rows)

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: "Impossible d'exporter le reporting." }, { status: 500 })
  }
}
