import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { readSnapshot } from "@/lib/server/supabase-store"
import { buildCaisseBalance } from "@/lib/server/analytics"

export async function GET() {
  const supabase = createClient()
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const db = await readSnapshot(supabase, { seedIfEmpty: Boolean(user), userId: user?.id || null })
    const result = buildCaisseBalance(db)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Impossible de calculer le solde caisse." }, { status: 500 })
  }
}
