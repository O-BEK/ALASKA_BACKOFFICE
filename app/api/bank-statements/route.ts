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
    const arrayBuffer = await file.arrayBuffer()
    const pdfjsLib = require("pdfjs-dist/legacy/build/pdf") as typeof import("pdfjs-dist")
    const { pathToFileURL } = await import("url")
    const workerPath = process.cwd() + "/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise

    let text = ""
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()

      // Group items by rounded Y position to reconstruct lines
      const lineMap = new Map<number, Array<{ str: string; x: number }>>()
      for (const item of content.items as Array<{ str: string; transform: number[] }>) {
        const y = Math.round(item.transform[5])
        if (!lineMap.has(y)) lineMap.set(y, [])
        lineMap.get(y)!.push({ str: item.str, x: item.transform[4] })
      }

      // Sort lines top-to-bottom (Y desc on PDF coords), items left-to-right
      const lines = Array.from(lineMap.entries())
        .sort(([a], [b]) => b - a)
        .map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.str).join("  "))

      text += lines.join("\n") + "\n"
    }

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
