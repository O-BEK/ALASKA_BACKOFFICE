import { NextResponse } from "next/server"
import { parseISO } from "date-fns"
import { buildWeekData, buildWeekEntries } from "@/lib/server/analytics"
import { createClient } from "@/lib/supabase/server"
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
    const db = await readSnapshot(supabase)
    const weekStart = parseISO(start)

    return NextResponse.json({
      summary: buildWeekData(db, weekStart),
      entries: buildWeekEntries(db, weekStart),
    })
  } catch {
    return NextResponse.json({ error: "Impossible de charger la semaine." }, { status: 500 })
  }
}
