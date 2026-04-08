import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { readSnapshot, updateFixedCharge } from "@/lib/server/supabase-store"

export async function GET() {
  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const db = await readSnapshot(supabase, { seedIfEmpty: Boolean(user), userId: user?.id || null })
    return NextResponse.json({ charges: db.fixed_charges })
  } catch {
    return NextResponse.json({ error: "Impossible de charger les charges." }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const body = await request.json()
  const chargeId = String(body?.id || "")
  if (!chargeId) {
    return NextResponse.json({ error: "Charge invalide." }, { status: 400 })
  }

  try {
    const charges = await updateFixedCharge(supabase, {
      id: chargeId,
      amount: typeof body.amount === "number" ? body.amount : undefined,
      is_active: typeof body.is_active === "boolean" ? body.is_active : undefined,
    })
    return NextResponse.json({ charges })
  } catch {
    return NextResponse.json({ error: "Impossible de mettre à jour la charge." }, { status: 500 })
  }
}
