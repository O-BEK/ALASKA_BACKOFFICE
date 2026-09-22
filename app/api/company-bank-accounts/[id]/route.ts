import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || !(await isAdmin(supabase, user.id))) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
    }

    const { count, error: countError } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("bank_account_id", params.id)

    if (countError) throw new Error(countError.message)
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "Ce compte est utilisé sur une facture et ne peut pas être supprimé." },
        { status: 409 }
      )
    }

    const { error } = await supabase
      .from("company_bank_accounts")
      .delete()
      .eq("id", params.id)

    if (error) throw new Error(error.message)
    return new Response(null, { status: 204 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/company-bank-accounts/[id] DELETE]", message)
    return NextResponse.json({ error: "Impossible de supprimer le compte bancaire." }, { status: 500 })
  }
}
