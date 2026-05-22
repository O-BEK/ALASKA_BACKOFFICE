import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { renderToBuffer } from "@react-pdf/renderer"
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

    if (error || !data) {
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
      name: process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Alaska Neo Bistrot",
      address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS ?? "",
      rc: process.env.NEXT_PUBLIC_COMPANY_RC ?? "",
      ice: process.env.NEXT_PUBLIC_COMPANY_ICE ?? "",
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(
      React.createElement(InvoicePdf, {
        invoice: { ...data, lines },
        totals,
        logoBase64,
        company,
      }) as any
    )

    return new Response(pdfBuffer.buffer as ArrayBuffer, {
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
