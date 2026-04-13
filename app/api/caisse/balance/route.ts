import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient, getUserRole } from "@/lib/supabase/server"
import { readSnapshot } from "@/lib/server/supabase-store"
import { buildCaisseBalance } from "@/lib/server/analytics"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const since = searchParams.get("since")
  const supabase = createClient()
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
    }
    if (!(await getUserRole(supabase, user.id))) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
    }
    const db = await readSnapshot(createAdminClient())
    const result = buildCaisseBalance(db, since && /^\d{4}-\d{2}-\d{2}$/.test(since) ? since : undefined)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue"
    console.error("[api/caisse/balance]", message)
    return NextResponse.json({ error: "Impossible de calculer le solde caisse." }, { status: 500 })
  }
}
