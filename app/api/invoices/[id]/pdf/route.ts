import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { renderToBuffer } from "@react-pdf/renderer"
import type { DocumentProps } from "@react-pdf/renderer"
import { InvoicePdf } from "@/lib/pdf/InvoicePdf"
import { calcInvoiceTotals } from "@/lib/invoice-calculations"
import fs from "fs"
import path from "path"
import React from "react"

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
      console.error("[api/invoices/[id]/pdf]", error.message)
      return NextResponse.json({ error: "Impossible de charger la facture." }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Facture introuvable." }, { status: 404 })
    }

    const lines = (data.invoice_lines ?? []).sort(
      (a: { line_order: number }, b: { line_order: number }) => a.line_order - b.line_order
    )
    const totals = calcInvoiceTotals(lines)

    const logoPath = path.join(process.cwd(), "public", "logo.png")
    const logoBase64 = fs.existsSync(logoPath)
      ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`
      : undefined

    const company = {
      name: process.env.NEXT_PUBLIC_COMPANY_NAME ?? "KAYZARAN",
      address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS ?? "",
      ice: process.env.NEXT_PUBLIC_COMPANY_ICE ?? "",
    }

    const pdfBuffer = await renderToBuffer(
      React.createElement(InvoicePdf, {
        invoice: { ...data, lines },
        totals,
        logoBase64,
        company,
      }) as React.ReactElement<DocumentProps>
    )

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${data.invoice_number}.pdf"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/invoices/[id]/pdf]", message)
    return NextResponse.json({ error: "Impossible de générer le PDF." }, { status: 500 })
  }
}
