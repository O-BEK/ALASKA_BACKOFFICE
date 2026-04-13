import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient, getUserRole } from "@/lib/supabase/server"
import { getDailyEntry, saveDailyEntry } from "@/lib/server/supabase-store"
import type { DailyEntry } from "@/lib/types"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date")
  if (!date) return NextResponse.json({ error: "Date requise." }, { status: 400 })

  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 })
    if (!(await getUserRole(supabase, user.id))) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
    }
    return NextResponse.json(await getDailyEntry(createAdminClient(), date))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue"
    console.error("[api/daily-entry:GET]", message)
    return NextResponse.json({ error: "Impossible de charger la journée." }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 })
  if (!(await getUserRole(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const body = (await request.json()) as DailyEntry
  if (!body?.date) return NextResponse.json({ error: "Date requise." }, { status: 400 })

  try {
    return NextResponse.json(await saveDailyEntry(createAdminClient(), body, user.id))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue"
    console.error("[api/daily-entry:PUT]", message)
    return NextResponse.json({ error: "Impossible d'enregistrer la journée." }, { status: 500 })
  }
}
