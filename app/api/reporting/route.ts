import { NextResponse } from "next/server"
import { buildBankConsolidation, buildLastSixMonths, monthReporting } from "@/lib/server/analytics"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { readSnapshot } from "@/lib/server/supabase-store"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7)
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
    const bankConsolidation = await buildBankConsolidation(createAdminClient(), month).catch(() => ({
      has_data: false,
      banks: [] as Array<{ bank: string; label: string; total_debit: number; total_credit: number; transaction_count: number }>,
      total_debit: 0,
      total_credit: 0,
      import_count: 0,
    }))

    return NextResponse.json({
      ...monthReporting(db, month),
      last6: buildLastSixMonths(db, month),
      bankConsolidation,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue"
    console.error("[api/reporting]", message)
    return NextResponse.json({ error: "Impossible de charger le reporting.", detail: message }, { status: 500 })
  }
}
