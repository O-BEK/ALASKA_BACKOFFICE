import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || !(await isAdmin(supabase, user.id))) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("invoices")
      .select("*, invoice_lines (*)")
      .eq("id", params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: "Facture introuvable." }, { status: 404 })
      }
      console.error("[api/invoices/[id] GET]", error.message)
      return NextResponse.json({ error: "Impossible de charger la facture." }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Facture introuvable." }, { status: 404 })
    }

    const lines = (data.invoice_lines ?? []).sort(
      (a: { line_order: number }, b: { line_order: number }) => a.line_order - b.line_order
    )

    return NextResponse.json({ invoice: { ...data, lines } })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/invoices/[id] GET]", message)
    return NextResponse.json({ error: "Impossible de charger la facture." }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || !(await isAdmin(supabase, user.id))) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
    }

    const { status } = await request.json()
    if (!["draft", "sent", "paid"].includes(status)) {
      return NextResponse.json({ error: "Statut invalide." }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("invoices")
      .update({ status })
      .eq("id", params.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: "Facture introuvable." }, { status: 404 })
      }
      console.error("[api/invoices/[id] PATCH]", error.message)
      return NextResponse.json({ error: "Impossible de mettre à jour la facture." }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Facture introuvable." }, { status: 404 })
    }

    return NextResponse.json({ invoice: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/invoices/[id] PATCH]", message)
    return NextResponse.json({ error: "Impossible de mettre à jour la facture." }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || !(await isAdmin(supabase, user.id))) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
    }

    const { data: inv, error: fetchErr } = await supabase
      .from("invoices")
      .select("status")
      .eq("id", params.id)
      .single()

    if (fetchErr || !inv) {
      return NextResponse.json({ error: "Facture introuvable." }, { status: 404 })
    }
    if (inv.status !== "draft") {
      return NextResponse.json(
        { error: "Seules les factures en brouillon peuvent être supprimées." },
        { status: 409 }
      )
    }

    const { error } = await supabase.from("invoices").delete().eq("id", params.id)
    if (error) {
      console.error("[api/invoices/[id] DELETE]", error.message)
      return NextResponse.json({ error: "Impossible de supprimer la facture." }, { status: 500 })
    }

    return new Response(null, { status: 204 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/invoices/[id] DELETE]", message)
    return NextResponse.json({ error: "Impossible de supprimer la facture." }, { status: 500 })
  }
}
