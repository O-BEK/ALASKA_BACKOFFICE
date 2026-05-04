import "server-only"
import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createBankTransactionRule, listBankTransactionRules } from "@/lib/server/bank-store"

const ruleSchema = z.object({
  match_text: z.string().trim().min(2),
  classification: z.enum([
    "supplier_payment",
    "fixed_charge",
    "staff_payment",
    "cash_deposit",
    "owner_injection",
    "external_income",
    "bank_fee",
    "ignore",
    "uncategorized",
  ]),
  expense_category: z.enum(["MP", "RH", "CHARGES", "AUTRE"]).nullable().default(null),
  matched_label: z.string().trim().min(1),
})

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) return null
  return createAdminClient()
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })

  try {
    const rules = await listBankTransactionRules(admin)
    return NextResponse.json({ rules })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur interne"
    console.error("[api/bank-transaction-rules GET]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })

  const parsed = ruleSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 })
  }

  try {
    const rule = await createBankTransactionRule(admin, parsed.data)
    return NextResponse.json({ rule })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur interne"
    console.error("[api/bank-transaction-rules POST]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
