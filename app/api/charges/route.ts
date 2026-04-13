import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { updateFixedCharge, createFixedCharge } from "@/lib/server/supabase-store"
import { parseCreateChargeBody } from "@/lib/contracts"

export async function GET(request: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const scope = searchParams.get("scope")

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 })
    }

    if (scope === "staff") {
      const adminSupabase = createAdminClient()
      const { data, error } = await adminSupabase
        .from("fixed_charges")
        .select("id, name, payment_day, is_active, start_date, end_date")
        .eq("is_staff", true)
        .order("name", { ascending: true })

      if (error) {
        throw new Error(error.message)
      }

      return NextResponse.json({
        charges: (data || []).map((charge) => ({
          id: String(charge.id),
          name: String(charge.name),
          category: "PERSONNEL",
          amount: 0,
          type: "fixed",
          payment_day: charge.payment_day === null ? null : Number(charge.payment_day),
          is_staff: true,
          is_active: Boolean(charge.is_active),
          start_date: String(charge.start_date),
          end_date: charge.end_date ? String(charge.end_date) : null,
        })),
      })
    }

    if (!(await isAdmin(supabase, user.id))) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("fixed_charges")
      .select("id, name, category, amount, type, payment_day, is_staff, is_active, start_date, end_date")
      .order("category", { ascending: true })
      .order("name", { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ charges: data || [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue"
    console.error("[api/charges]", message)
    return NextResponse.json({ error: "Impossible de charger les charges." }, { status: 500 })
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

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  try {
    const body = parseCreateChargeBody(await request.json())
    const charges = await createFixedCharge(supabase, body)
    return NextResponse.json({ charges })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json({ error: `Impossible de créer la charge. ${message}` }, { status: 500 })
  }
}
