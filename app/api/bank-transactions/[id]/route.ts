import "server-only"
import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { updateBankTransactionReview } from "@/lib/server/bank-store"

const bodySchema = z.object({
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
  matched_label: z.string().trim().nullable().default(null),
  review_status: z.enum(["suggested", "confirmed", "ignored"]).default("confirmed"),
  notes: z.string().trim().nullable().optional(),
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 })
  }

  try {
    const transaction = await updateBankTransactionReview(createAdminClient(), params.id, parsed.data)
    return NextResponse.json({ transaction })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur interne"
    console.error("[api/bank-transactions/[id]]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
