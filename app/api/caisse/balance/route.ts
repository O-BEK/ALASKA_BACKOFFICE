import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
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
    const db = await readSnapshot(supabase)
    const result = buildCaisseBalance(db, since && /^\d{4}-\d{2}-\d{2}$/.test(since) ? since : undefined)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Impossible de calculer le solde caisse." }, { status: 500 })
  }
}
