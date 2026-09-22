import { NextResponse } from "next/server"
import { createCompanyBankAccountBodySchema } from "@/lib/contracts"
import { createClient, isAdmin } from "@/lib/supabase/server"

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
      .from("company_bank_accounts")
      .select("id, label, bank_name, bank_code, city_code, account_number, rib_key, iban, is_active, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: true })

    if (error) throw new Error(error.message)
    return NextResponse.json({ bank_accounts: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/company-bank-accounts GET]", message)
    return NextResponse.json({ error: "Impossible de charger les comptes bancaires." }, { status: 500 })
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

    const body = createCompanyBankAccountBodySchema.parse(await request.json())
    const { data, error } = await supabase
      .from("company_bank_accounts")
      .insert({
        ...body,
        bank_code: body.bank_code || null,
        city_code: body.city_code || null,
        rib_key: body.rib_key || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error || !data) {
      if (error?.code === "23505") {
        return NextResponse.json({ error: "Ce compte bancaire existe déjà." }, { status: 409 })
      }
      throw new Error(error?.message ?? "Échec création")
    }

    return NextResponse.json({ bank_account: data }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/company-bank-accounts POST]", message)
    return NextResponse.json({ error: "Impossible d'ajouter le compte bancaire." }, { status: 500 })
  }
}
