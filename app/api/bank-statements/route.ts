import "server-only"
import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { parseBanquePopulaire } from "@/lib/bank-parsers/banque-populaire"
import { parseCfg } from "@/lib/bank-parsers/cfg"
import { listBankImports } from "@/lib/server/bank-store"
import type { BankCode } from "@/lib/bank-parsers/types"

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }
  try {
    const imports = await listBankImports(createAdminClient())
    return NextResponse.json({ imports })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur interne"
    console.error("[api/bank-statements GET]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const bank = formData.get("bank") as BankCode | null

  if (!file || !bank || !["bp", "cfg"].includes(bank)) {
    return NextResponse.json({ error: "Fichier PDF et banque requis (bp | cfg)." }, { status: 400 })
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Format non supporté. Fichier .pdf requis." }, { status: 400 })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require("pdf-parse") as typeof import("pdf-parse")
    const buffer = Buffer.from(await file.arrayBuffer())
    const parser = new PDFParse({ data: buffer })
    const parsed = await parser.getText()
    const text = parsed.text

    const statement = bank === "bp" ? parseBanquePopulaire(text) : parseCfg(text)

    if (statement.transactions.length === 0) {
      return NextResponse.json({
        error: "Aucune transaction détectée dans ce PDF. Le format du relevé n'a pas pu être reconnu.",
        ...(process.env.NODE_ENV === "development" && { debug_text: text.slice(0, 500) }),
      }, { status: 422 })
    }

    return NextResponse.json({ preview: statement })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur interne"
    console.error("[api/bank-statements POST]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
