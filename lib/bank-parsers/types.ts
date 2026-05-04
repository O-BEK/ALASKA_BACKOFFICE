export type BankCode = "bp" | "cfg"

export interface BankTransaction {
  date: string   // YYYY-MM-DD
  label: string
  debit: number
  credit: number
  balance: number
  bank?: string  // present when fetched from DB, absent when parsed from PDF
}

export interface ParsedStatement {
  bank: BankCode
  period_start: string
  period_end: string
  transactions: BankTransaction[]
}
