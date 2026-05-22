import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { createClientBodySchema } from "@/lib/contracts"

export async function GET() {
  const supabase = createClient()
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || !(await isAdmin(supabase, user.id))) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("clients")
      .select("id, name, address, ice, created_at")
      .order("name", { ascending: true })

    if (error) throw new Error(error.message)
    return NextResponse.json({ clients: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/clients GET]", message)
    return NextResponse.json({ error: "Impossible de charger les entreprises." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = createClient()
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || !(await isAdmin(supabase, user.id))) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
    }

    const raw = await request.json()
    const body = createClientBodySchema.parse(raw)

    const { data, error } = await supabase
      .from("clients")
      .insert({
        name: body.name,
        address: body.address ?? null,
        ice: body.ice ?? null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error || !data) throw new Error(error?.message ?? "Échec création")
    return NextResponse.json({ client: data }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/clients POST]", message)
    return NextResponse.json({ error: "Impossible de créer l'entreprise." }, { status: 500 })
  }
}
