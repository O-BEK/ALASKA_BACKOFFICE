import type { SupabaseClient } from "@supabase/supabase-js"

export function buildInvoiceNumber(year: number, lastInvoiceNumber: string | null): string {
  const prefix = `FAC-${year}-`
  if (!lastInvoiceNumber) return `${prefix}001`
  const lastNum = parseInt(lastInvoiceNumber.slice(prefix.length), 10)
  const next = isNaN(lastNum) ? 1 : lastNum + 1
  return `${prefix}${String(next).padStart(3, "0")}`
}

export async function nextInvoiceNumber(supabase: SupabaseClient, year?: number): Promise<string> {
  const y = year ?? new Date().getFullYear()
  const prefix = `FAC-${y}-`
  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1)
    .maybeSingle()
  return buildInvoiceNumber(y, data?.invoice_number ?? null)
}
