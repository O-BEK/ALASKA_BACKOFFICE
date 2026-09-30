import type { SupabaseClient } from "@supabase/supabase-js"

export const INVOICE_NUMBER_PREFIX = "FAC2025"
export const LAST_LEGACY_INVOICE_SEQUENCE = 30

export function buildInvoiceNumber(invoiceNumbers: string[]): string {
  const highestSequence = invoiceNumbers.reduce((highest, invoiceNumber) => {
    if (!invoiceNumber.startsWith(INVOICE_NUMBER_PREFIX)) return highest
    const sequence = Number(invoiceNumber.slice(INVOICE_NUMBER_PREFIX.length))
    return Number.isInteger(sequence) && sequence > highest ? sequence : highest
  }, LAST_LEGACY_INVOICE_SEQUENCE)

  return `${INVOICE_NUMBER_PREFIX}${highestSequence + 1}`
}

export async function nextInvoiceNumber(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `${INVOICE_NUMBER_PREFIX}%`)

  if (error) throw new Error(error.message)
  return buildInvoiceNumber((data ?? []).map((invoice) => invoice.invoice_number))
}
