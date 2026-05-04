export type BankCode = "bp" | "cfg"
export type BankTransactionClassification =
  | "supplier_payment"
  | "fixed_charge"
  | "staff_payment"
  | "cash_deposit"
  | "owner_injection"
  | "external_income"
  | "bank_fee"
  | "ignore"
  | "uncategorized"

export type BankTransactionReviewStatus = "suggested" | "confirmed" | "ignored"
export type BankExpenseCategory = "MP" | "RH" | "CHARGES" | "AUTRE"

export interface BankTransaction {
  id?: string
  import_id?: string
  date: string   // YYYY-MM-DD
  label: string
  debit: number
  credit: number
  balance: number
  bank?: string  // present when fetched from DB, absent when parsed from PDF
  classification?: BankTransactionClassification
  expense_category?: BankExpenseCategory | null
  matched_label?: string | null
  review_status?: BankTransactionReviewStatus
  notes?: string | null
}

export interface ParsedStatement {
  bank: BankCode
  period_start: string
  period_end: string
  transactions: BankTransaction[]
}
