import "server-only"
import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { saveBankImport, saveBankTransactions, deleteBankImport, uploadBankStatementFile } from "@/lib/server/bank-store"
import type { ParsedStatement } from "@/lib/bank-parsers/types"

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120)
}

function decodeBase64File(value: string): Uint8Array {
  const base64 = value.includes(",") ? value.split(",").pop() ?? "" : value
  return new Uint8Array(Buffer.from(base64, "base64"))
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const body = await request.json() as { statement: ParsedStatement; filename: string; file_base64?: string }
  if (!body?.statement?.bank || !Array.isArray(body?.statement?.transactions)) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 })
  }
  if (!body.file_base64) {
    return NextResponse.json({ error: "PDF requis pour archiver le relevé." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { statement, filename } = body
  const safeFilename = sanitizeFilename(filename || "releve.pdf")
  const storagePath = `${statement.bank}/${statement.period_start?.slice(0, 7)}/${Date.now()}-${safeFilename}`

  try {
    await uploadBankStatementFile(admin, storagePath, decodeBase64File(body.file_base64))
    const importRecord = await saveBankImport(admin, user.id, statement, storagePath)
    try {
      await saveBankTransactions(admin, importRecord.id, statement.bank, statement.transactions)
    } catch (txErr) {
      await deleteBankImport(admin, importRecord.id)
      throw txErr
    }
    return NextResponse.json({ import: importRecord, count: statement.transactions.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur interne"
    console.error("[api/bank-statements/commit]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
