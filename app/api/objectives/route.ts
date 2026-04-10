import { NextResponse } from "next/server"
import { buildMonthlyKpis } from "@/lib/server/analytics"
import { ACTION_ITEMS, MONTHLY_OBJECTIVES_2026, OBJECTIVES } from "@/lib/mock-data"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { readSnapshot, updateActionStatus } from "@/lib/server/supabase-store"

export async function GET() {
  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
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

    return NextResponse.json({
      actions: db.action_items,
      objectives: db.objectives,
      monthlyObjectives: db.monthly_objectives,
      monthlyReal,
    })
  } catch {
    return NextResponse.json({
      actions: ACTION_ITEMS,
      objectives: OBJECTIVES,
      monthlyObjectives: MONTHLY_OBJECTIVES_2026,
      monthlyReal: MONTHLY_OBJECTIVES_2026.map((item) => ({
        year: item.year,
        month: item.month,
        real: 0,
        target: item.target_ca,
        notes: item.notes || "",
      })),
      degraded: true,
    })
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

  const body = await request.json()
  const actionId = String(body?.id || "")
  const status = String(body?.status || "")
  if (!actionId || !status) {
    return NextResponse.json({ error: "Action invalide." }, { status: 400 })
  }

  try {
    const actions = await updateActionStatus(supabase, {
      id: actionId,
      status: status as "todo" | "in_progress" | "done" | "cancelled",
    })
    return NextResponse.json({ actions })
  } catch {
    return NextResponse.json({ error: "Impossible de mettre à jour l'action." }, { status: 500 })
  }
}
