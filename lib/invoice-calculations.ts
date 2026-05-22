export interface InvoiceLineInput {
  quantity: number
  unit_price_ht: number
  tva_rate: number
}

export interface InvoiceTotals {
  total_ht: number
  tva_amount: number
  total_ttc: number
}

export function calcLineTotalHt(line: InvoiceLineInput): number {
  return line.quantity * line.unit_price_ht
}

export function calcInvoiceTotals(lines: InvoiceLineInput[]): InvoiceTotals {
  const total_ht = lines.reduce((sum, l) => sum + calcLineTotalHt(l), 0)
  const tva_amount = lines.reduce((sum, l) => sum + calcLineTotalHt(l) * (l.tva_rate / 100), 0)
  return { total_ht, tva_amount, total_ttc: total_ht + tva_amount }
}
