import { describe, expect, it } from "vitest"
import {
  createCompanyBankAccountBodySchema,
  createInvoiceBodySchema,
  parseInvoicesPayload,
} from "../lib/contracts"

const line = {
  description: "Prestation restauration",
  quantity: 1,
  unit_price_ht: 1000,
  tva_rate: 10,
  line_order: 0,
}

describe("invoice payment validation", () => {
  it("accepts cheque payment without a bank account", () => {
    const result = createInvoiceBodySchema.parse({
      client_name: "Client test",
      invoice_date: "2026-09-22",
      payment_method: "cheque",
      lines: [line],
    })

    expect(result.payment_method).toBe("cheque")
    expect(result.bank_account_id).toBeUndefined()
  })

  it("accepts bank transfer with a selected company account", () => {
    const result = createInvoiceBodySchema.parse({
      client_name: "Client test",
      invoice_date: "2026-09-22",
      payment_method: "bank_transfer",
      bank_account_id: "11111111-1111-4111-8111-111111111111",
      lines: [line],
    })

    expect(result.payment_method).toBe("bank_transfer")
  })

  it("rejects bank transfer without a selected account", () => {
    const result = createInvoiceBodySchema.safeParse({
      client_name: "Client test",
      invoice_date: "2026-09-22",
      payment_method: "bank_transfer",
      lines: [line],
    })

    expect(result.success).toBe(false)
  })

  it("keeps legacy invoice payloads compatible", () => {
    const result = parseInvoicesPayload({
      total: 1,
      invoices: [{
        id: "invoice-1",
        invoice_number: "FAC-2026-001",
        client_name: "Client test",
        client_rc: null,
        client_address: null,
        invoice_date: "2026-09-22",
        status: "draft",
        notes: null,
        created_by: null,
        created_at: "2026-09-22T12:00:00Z",
        total_ht: 1000,
        tva_amount: 100,
        total_ttc: 1100,
      }],
    })

    expect(result.invoices[0].payment_method).toBe("bank_transfer")
    expect(result.invoices[0].bank_account_id).toBeNull()
  })
})

describe("company bank account validation", () => {
  it("normalizes surrounding whitespace", () => {
    const result = createCompanyBankAccountBodySchema.parse({
      label: "  Compte BP  ",
      bank_name: "  Banque Populaire  ",
      account_number: "  1234567890  ",
      iban: "  MA001234567890  ",
    })

    expect(result).toMatchObject({
      label: "Compte BP",
      bank_name: "Banque Populaire",
      account_number: "1234567890",
      iban: "MA001234567890",
    })
  })

  it("requires the account identity fields", () => {
    const result = createCompanyBankAccountBodySchema.safeParse({
      label: "Compte BP",
      bank_name: "Banque Populaire",
      account_number: "",
      iban: "",
    })

    expect(result.success).toBe(false)
  })
})
