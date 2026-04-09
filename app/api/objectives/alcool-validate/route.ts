import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { applyAlcoolLicenseUplift } from "@/lib/server/supabase-store"

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  try {
    const body = await request.json()
    const actionId = String(body?.actionId || "")
    const effectMonth = String(body?.effectMonth || "")
    const upliftPct = Number(body?.upliftPct ?? 47)

    if (!actionId || !effectMonth || !/^\d{4}-\d{2}$/.test(effectMonth)) {
      return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 })
    }
    if (upliftPct < 1 || upliftPct > 200) {
      return NextResponse.json({ error: "Uplift doit être entre 1 et 200%." }, { status: 400 })
    }

    const monthlyObjectives = await applyAlcoolLicenseUplift(supabase, {
      actionId,
      effectMonth,
      upliftPct,
    })
    return NextResponse.json({ monthlyObjectives, applied: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json({ error: `Impossible d'appliquer l'uplift. ${message}` }, { status: 500 })
  }
}
