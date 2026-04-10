import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"
import {
  getExpenseSections,
  createExpenseSection,
  deleteExpenseSection,
  createExpenseItem,
  deleteExpenseItem,
} from "@/lib/server/supabase-store"

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Accès non autorisé." }, { status: 401 })
  try {
    const sections = await getExpenseSections(supabase)
    return NextResponse.json({ sections })
  } catch {
    return NextResponse.json({ error: "Impossible de charger les modèles." }, { status: 500 })
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

  const body = await request.json()

  try {
    if (body.type === "section") {
      const { name, emoji, expense_category } = body
      if (!name || !expense_category)
        return NextResponse.json({ error: "Données manquantes." }, { status: 400 })
      const sections = await createExpenseSection(supabase, {
        name,
        emoji: emoji || "📦",
        expense_category,
      })
      return NextResponse.json({ sections })
    }

    if (body.type === "item") {
      const { section_id, label } = body
      if (!section_id || !label)
        return NextResponse.json({ error: "Données manquantes." }, { status: 400 })
      const sections = await createExpenseItem(supabase, { section_id, label })
      return NextResponse.json({ sections })
    }

    return NextResponse.json({ error: "Type invalide." }, { status: 400 })
  } catch {
    return NextResponse.json({ error: "Impossible de créer l'élément." }, { status: 500 })
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

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const type = searchParams.get("type")
  if (!id || !type)
    return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 })

  try {
    const sections =
      type === "section"
        ? await deleteExpenseSection(supabase, id)
        : await deleteExpenseItem(supabase, id)
    return NextResponse.json({ sections })
  } catch {
    return NextResponse.json({ error: "Impossible de supprimer." }, { status: 500 })
  }
}
