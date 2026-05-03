import "server-only"
import type { BankTransaction, BankCode, ParsedStatement } from "@/lib/bank-parsers/types"

export interface BankImportRecord {
  id: string
  bank: BankCode
  period_start: string
  period_end: string
  storage_path: string
  imported_at: string
  transaction_count: number
}

export async function listBankImports(supabase: any): Promise<BankImportRecord[]> {
  const { data, error } = await supabase
    .from("bank_statement_imports")
    .select("*")
    .order("period_start", { ascending: false })
    .limit(24)
  if (error) throw new Error(error.message)
  return (data ?? []) as BankImportRecord[]
}

export async function saveBankImport(
  supabase: any,
  userId: string,
  statement: ParsedStatement,
  storagePath: string
): Promise<BankImportRecord> {
  const { data, error } = await supabase
    .from("bank_statement_imports")
    .insert({
      bank: statement.bank,
      period_start: statement.period_start,
      period_end: statement.period_end,
      storage_path: storagePath,
      transaction_count: statement.transactions.length,
      user_id: userId,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as BankImportRecord
}

export async function saveBankTransactions(
  supabase: any,
  importId: string,
  bank: BankCode,
  transactions: BankTransaction[]
): Promise<void> {
  if (transactions.length === 0) return
  const rows = transactions.map((t) => ({
    import_id: importId,
    bank,
    date: t.date,
    label: t.label,
    debit: t.debit,
    credit: t.credit,
    balance: t.balance,
  }))
  const { error } = await supabase.from("bank_transactions").insert(rows)
  if (error) throw new Error(error.message)
}

export async function getBankTransactions(
  supabase: any,
  importId: string
): Promise<BankTransaction[]> {
  const { data, error } = await supabase
    .from("bank_transactions")
    .select("*")
    .eq("import_id", importId)
    .order("date", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as BankTransaction[]
}

export async function getBankTransactionsByPeriod(
  supabase: any,
  month: string
): Promise<BankTransaction[]> {
  const { data, error } = await supabase
    .from("bank_transactions")
    .select("*")
    .gte("date", `${month}-01`)
    .lte("date", `${month}-31`)
    .order("date", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as BankTransaction[]
}
