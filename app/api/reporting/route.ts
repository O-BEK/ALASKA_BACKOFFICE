import { NextResponse } from "next/server"
import { buildBankConsolidation, buildCashMonthSummary, buildFinancialConsolidation, buildLast4WeeksComparison, buildLastSixMonths, monthReporting } from "@/lib/server/analytics"
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
    const admin = createAdminClient()
    const bankConsolidation = await buildBankConsolidation(admin, month).catch(() => ({
      has_data: false,
      banks: [] as Array<{ bank: string; label: string; total_debit: number; total_credit: number; transaction_count: number }>,
      total_debit: 0,
      total_credit: 0,
      import_count: 0,
    }))
    const financialConsolidation = await buildFinancialConsolidation(db, admin, month).catch(() => ({
      has_data: false,
      ca_pos: 0,
      cash_expenses: 0,
      cash_deposits: 0,
      bank_expenses: 0,
      external_income: 0,
      owner_injections: 0,
      bank_cash_deposits: 0,
      bank_debits: 0,
      bank_credits: 0,
      bank_net: 0,
      real_result: 0,
      owner_support_needed: 0,
      pending_review_count: 0,
      confirmed_count: 0,
      status: "loss" as const,
      alert: "",
      by_classification: [] as Array<{ classification: string; debit: number; credit: number; count: number }>,
    }))

    const cashSummary = buildCashMonthSummary(db, month)
    const weekComparison = buildLast4WeeksComparison(db)

    return NextResponse.json({
      ...monthReporting(db, month),
      last6: buildLastSixMonths(db, month),
      bankConsolidation,
      financialConsolidation,
      weekComparison,
      primeCost: cashSummary.prime_cost_pct,
      resultatNet: cashSummary.resultat_net,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue"
    console.error("[api/reporting]", message)
    return NextResponse.json({ error: "Impossible de charger le reporting.", detail: message }, { status: 500 })
  }
}
