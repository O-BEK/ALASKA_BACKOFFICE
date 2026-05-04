import "server-only"
import type { BankTransaction, BankCode, ParsedStatement } from "@/lib/bank-parsers/types"
import {
  classifyBankTransaction,
  type BankTransactionRule,
} from "@/lib/bank-classification"
import type {
  BankExpenseCategory,
  BankTransactionClassification,
  BankTransactionReviewStatus,
} from "@/lib/bank-parsers/types"

export interface BankImportRecord {
  id: string
  bank: BankCode
  period_start: string
  period_end: string
  storage_path: string
  imported_at: string
  transaction_count: number
  confirmed_count?: number
  pending_count?: number
  ignored_count?: number
}

export async function listBankImports(supabase: any): Promise<BankImportRecord[]> {
  const { data, error } = await supabase
    .from("bank_statement_imports")
    .select("*")
    .order("period_start", { ascending: false })
    .limit(24)
  if (error) throw new Error(error.message)
  const imports = (data ?? []) as BankImportRecord[]
  if (imports.length === 0) return imports

  const ids = imports.map((item) => item.id)
  const txRes = await supabase
    .from("bank_transactions")
    .select("import_id, review_status")
    .in("import_id", ids)

  if (txRes.error) return imports

  const stats = new Map<string, { confirmed_count: number; pending_count: number; ignored_count: number }>()
  for (const row of txRes.data ?? []) {
    const key = String(row.import_id)
    const current = stats.get(key) ?? { confirmed_count: 0, pending_count: 0, ignored_count: 0 }
    if (row.review_status === "confirmed") current.confirmed_count += 1
    else if (row.review_status === "ignored") current.ignored_count += 1
    else current.pending_count += 1
    stats.set(key, current)
  }

  return imports.map((item) => ({
    ...item,
    ...(stats.get(item.id) ?? { confirmed_count: 0, pending_count: item.transaction_count, ignored_count: 0 }),
  }))
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
  const rules = await listBankTransactionRules(supabase)
  const rows = transactions.map((raw) => {
    const t = classifyBankTransaction(raw, rules)
    return {
    import_id: importId,
    bank,
    date: t.date,
    label: t.label,
    debit: t.debit,
    credit: t.credit,
    balance: t.balance,
    classification: t.classification,
    expense_category: t.expense_category,
    matched_label: t.matched_label,
    review_status: t.review_status,
    notes: t.notes,
  }
  })
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
  const [year, mon] = month.split("-").map(Number)
  const lastDay = new Date(year, mon, 0).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from("bank_transactions")
    .select("*")
    .gte("date", `${month}-01`)
    .lte("date", lastDay)
    .order("date", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as BankTransaction[]
}

export async function deleteBankImport(supabase: any, importId: string): Promise<void> {
  await supabase.from("bank_statement_imports").delete().eq("id", importId)
}

export async function listBankTransactionRules(supabase: any): Promise<BankTransactionRule[]> {
  const { data, error } = await supabase
    .from("bank_transaction_rules")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
  if (error) {
    // Allows older databases to keep importing before the additive migration is applied.
    if (String(error.message).includes("bank_transaction_rules")) return []
    throw new Error(error.message)
  }
  return (data ?? []) as BankTransactionRule[]
}

export async function updateBankTransactionReview(
  supabase: any,
  id: string,
  patch: {
    classification: BankTransactionClassification
    expense_category: BankExpenseCategory | null
    matched_label: string | null
    review_status: BankTransactionReviewStatus
    notes?: string | null
  }
): Promise<BankTransaction> {
  const { data, error } = await supabase
    .from("bank_transactions")
    .update(patch)
    .eq("id", id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as BankTransaction
}

export async function createBankTransactionRule(
  supabase: any,
  rule: Omit<BankTransactionRule, "id" | "is_active">
): Promise<BankTransactionRule> {
  const { data, error } = await supabase
    .from("bank_transaction_rules")
    .insert({ ...rule, is_active: true })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as BankTransactionRule
}

export async function uploadBankStatementFile(
  supabase: any,
  storagePath: string,
  bytes: Uint8Array,
  contentType = "application/pdf"
): Promise<void> {
  const { error } = await supabase
    .storage
    .from("bank-statements")
    .upload(storagePath, bytes, { contentType, upsert: false })
  if (error) throw new Error(error.message)
}
