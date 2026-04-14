import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { updateMonthlyObjective } from "@/lib/server/supabase-store"

export async function PUT(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  try {
    const body = await request.json()
    const year = Number(body?.year)
    const month = Number(body?.month)
    const target_ca = Number(body?.target_ca)
    if (!year || !month || isNaN(target_ca)) {
      return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 })
    }
    const monthlyObjectives = await updateMonthlyObjective(supabase, year, month, target_ca)
    return NextResponse.json({ monthlyObjectives })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue"
    console.error("[api/objectives/monthly PUT]", message)
    return NextResponse.json({ error: "Mise à jour impossible." }, { status: 500 })
  }
}
