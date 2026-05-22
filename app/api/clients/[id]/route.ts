import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"

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

    const { error } = await supabase.from("clients").delete().eq("id", params.id)
    if (error) {
      console.error("[api/clients/[id] DELETE]", error.message)
      return NextResponse.json({ error: "Impossible de supprimer l'entreprise." }, { status: 500 })
    }

    return new Response(null, { status: 204 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/clients/[id] DELETE]", message)
    return NextResponse.json({ error: "Impossible de supprimer l'entreprise." }, { status: 500 })
  }
}
