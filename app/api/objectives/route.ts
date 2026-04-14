import { NextResponse } from "next/server"
import { buildMonthlyKpis } from "@/lib/server/analytics"
import { createClient, isAdmin } from "@/lib/supabase/server"
import {
  createActionItem,
  deleteActionItem,
  readSnapshot,
  updateActionItem,
} from "@/lib/server/supabase-store"
import { parseCreateActionBody, parseUpdateActionBody } from "@/lib/contracts"

async function buildObjectivesPayload(supabase: ReturnType<typeof createClient>) {
  const db = await readSnapshot(supabase)
  const monthlyReal = db.monthly_objectives.map((item) => {
    const monthKey = `${item.year}-${String(item.month).padStart(2, "0")}`
    const monthly = buildMonthlyKpis(db, monthKey)
    return {
      year: item.year,
      month: item.month,
      real: monthly.ca_total,
      target: item.target_ca,
      notes: item.notes || "",
    }
  })
  return {
    actions: db.action_items,
    objectives: db.objectives,
    monthlyObjectives: db.monthly_objectives,
    monthlyReal,
  }
}

export async function GET() {
  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 })
    }
    if (!(await isAdmin(supabase, user.id))) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
    }
    return NextResponse.json(await buildObjectivesPayload(supabase))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue"
    console.error("[api/objectives GET]", message)
    return NextResponse.json({ error: "Impossible de charger les objectifs." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  try {
    const body = parseCreateActionBody(await request.json())
    await createActionItem(supabase, { ...body, userId: user.id })
    return NextResponse.json(await buildObjectivesPayload(supabase))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue"
    console.error("[api/objectives POST]", message)
    return NextResponse.json({ error: "Impossible de créer l'action." }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  try {
    const body = parseUpdateActionBody(await request.json())
    await updateActionItem(supabase, body)
    return NextResponse.json(await buildObjectivesPayload(supabase))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue"
    console.error("[api/objectives PUT]", message)
    return NextResponse.json({ error: "Impossible de mettre à jour l'action." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "Paramètre id manquant." }, { status: 400 })
    }
    await deleteActionItem(supabase, id)
    return NextResponse.json(await buildObjectivesPayload(supabase))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue"
    console.error("[api/objectives DELETE]", message)
    return NextResponse.json({ error: "Impossible de supprimer l'action." }, { status: 500 })
  }
}
