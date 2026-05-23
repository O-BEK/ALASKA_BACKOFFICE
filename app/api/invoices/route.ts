import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { calcInvoiceTotals } from "@/lib/invoice-calculations"
import { createInvoiceBodySchema } from "@/lib/contracts"
import { nextInvoiceNumber } from "@/lib/server/invoice-utils"
import type { InvoiceWithTotals } from "@/lib/types"

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
      .from("invoices")
      .select("*, invoice_lines (id, quantity, unit_price_ht, tva_rate, line_order)")
      .order("invoice_date", { ascending: false })

    if (error) throw new Error(error.message)

    const invoices: InvoiceWithTotals[] = (data ?? []).map((inv: any) => {
      const lines: Array<{ quantity: number; unit_price_ht: number; tva_rate: number }> =
        inv.invoice_lines ?? []
      const { total_ht, tva_amount, total_ttc } = calcInvoiceTotals(lines)
      const { invoice_lines: _lines, ...rest } = inv
      return { ...rest, total_ht, tva_amount, total_ttc }
    })

    return NextResponse.json({ invoices, total: invoices.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/invoices GET]", message)
    return NextResponse.json({ error: "Impossible de charger les factures." }, { status: 500 })
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
    const body = createInvoiceBodySchema.parse(raw)
    const invoice_number = await nextInvoiceNumber(supabase)

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .insert({
        invoice_number,
        client_name: body.client_name,
        client_rc: body.client_rc ?? null,
        client_address: body.client_address ?? null,
        invoice_date: body.invoice_date,
        notes: body.notes ?? null,
        created_by: user.id,
      })
      .select()
      .single()

    if (invErr || !invoice) throw new Error(invErr?.message ?? "Échec création facture")

    const lineRows = body.lines.map((l, i) => ({
      invoice_id: invoice.id,
      description: l.description,
      quantity: l.quantity,
      unit_price_ht: l.unit_price_ht,
      tva_rate: l.tva_rate,
      line_order: l.line_order ?? i,
    }))

    const { error: linesErr } = await supabase.from("invoice_lines").insert(lineRows)
    if (linesErr) throw new Error(linesErr.message)

    return NextResponse.json({ invoice }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/invoices POST]", message)
    return NextResponse.json(
      { error: `Impossible de créer la facture. ${message}` },
      { status: 500 }
    )
  }
}
