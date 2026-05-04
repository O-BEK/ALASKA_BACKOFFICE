import "server-only"
import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBankTransactions } from "@/lib/server/bank-store"

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 })
  }

  try {
    const transactions = await getBankTransactions(createAdminClient(), params.id)
    return NextResponse.json({ transactions })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur interne"
    console.error("[api/bank-statements/[id]]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
