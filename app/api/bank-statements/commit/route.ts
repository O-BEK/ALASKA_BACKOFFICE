import "server-only"
import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { saveBankImport, saveBankTransactions, deleteBankImport } from "@/lib/server/bank-store"
import type { ParsedStatement } from "@/lib/bank-parsers/types"

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const body = await request.json() as { statement: ParsedStatement; filename: string }
  if (!body?.statement?.bank || !Array.isArray(body?.statement?.transactions)) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { statement, filename } = body
  const storagePath = `${statement.bank}/${statement.period_start?.slice(0, 7)}/${filename}`

  try {
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
