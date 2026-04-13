import { NextResponse } from "next/server"
import { parseISO } from "date-fns"
import { buildWeekData, buildWeekEntries } from "@/lib/server/analytics"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient, getUserRole } from "@/lib/supabase/server"
import { readSnapshot } from "@/lib/server/supabase-store"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const start = searchParams.get("start")
  if (!start) return NextResponse.json({ error: "Semaine requise." }, { status: 400 })

  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 })
    }
    if (!(await getUserRole(supabase, user.id))) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
    }
    const db = await readSnapshot(createAdminClient())
    const weekStart = parseISO(start)

    return NextResponse.json({
      summary: buildWeekData(db, weekStart),
      entries: buildWeekEntries(db, weekStart),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue"
    console.error("[api/week]", message)
    return NextResponse.json({ error: "Impossible de charger la semaine." }, { status: 500 })
  }
}
