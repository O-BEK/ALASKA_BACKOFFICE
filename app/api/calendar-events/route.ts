import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month") // ex: 2026-05
  const year = searchParams.get("year")   // ex: 2026

  const adminSupabase = createAdminClient()
  let query = adminSupabase
    .from("calendar_events")
    .select("id, date_start, date_end, type, name, impact, notes, editable")
    .order("date_start", { ascending: true })

  if (month) {
    const [y, m] = month.split("-")
    const lastDay = new Date(Number(y), Number(m), 0).getDate()
    query = query
      .lte("date_start", `${month}-${lastDay}`)
      .gte("date_end", `${month}-01`)
  } else if (year) {
    query = query
      .gte("date_start", `${year}-01-01`)
      .lte("date_end", `${year}-12-31`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ events: data || [] })
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const body = await request.json()
  const { date_start, date_end, type, name, impact, notes } = body

  if (!date_start || !date_end || !type || !name || !impact) {
    return NextResponse.json({ error: "Champs requis manquants." }, { status: 400 })
  }

  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from("calendar_events")
    .insert({ date_start, date_end, type, name, impact, notes: notes || null, editable: true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ event: data }, { status: 201 })
}

export async function PUT(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const body = await request.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: "ID manquant." }, { status: 400 })

  const adminSupabase = createAdminClient()
  const { data: existing } = await adminSupabase
    .from("calendar_events")
    .select("editable")
    .eq("id", id)
    .single()

  if (!existing?.editable) {
    return NextResponse.json({ error: "Cet événement ne peut pas être modifié." }, { status: 403 })
  }

  const allowedUpdates = {
    ...(updates.date_start && { date_start: updates.date_start }),
    ...(updates.date_end && { date_end: updates.date_end }),
    ...(updates.name && { name: updates.name }),
    ...(updates.impact && { impact: updates.impact }),
    notes: updates.notes ?? null,
  }

  const { data, error } = await adminSupabase
    .from("calendar_events")
    .update(allowedUpdates)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ event: data })
}

export async function DELETE(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "ID manquant." }, { status: 400 })

  const adminSupabase = createAdminClient()
  const { data: existing } = await adminSupabase
    .from("calendar_events")
    .select("editable")
    .eq("id", id)
    .single()

  if (!existing?.editable) {
    return NextResponse.json({ error: "Cet événement ne peut pas être supprimé." }, { status: 403 })
  }

  const { error } = await adminSupabase
    .from("calendar_events")
    .delete()
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
