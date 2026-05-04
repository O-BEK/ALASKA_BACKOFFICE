import { describe, expect, it } from "vitest"
import { classifyBankTransaction } from "../lib/bank-classification"

describe("classifyBankTransaction", () => {
  it("classe un débit fournisseur via règle", () => {
    const result = classifyBankTransaction(
      { date: "2026-04-05", label: "VIREMENT FOURNISSEUR ALI", debit: 2500, credit: 0, balance: 10000 },
      [{ match_text: "FOURNISSEUR ALI", classification: "supplier_payment", expense_category: "MP", matched_label: "Fournisseur Ali" }]
    )

    expect(result.classification).toBe("supplier_payment")
    expect(result.expense_category).toBe("MP")
    expect(result.matched_label).toBe("Fournisseur Ali")
    expect(result.review_status).toBe("suggested")
  })

  it("classe un crédit de versement comme dépôt cash neutre", () => {
    const result = classifyBankTransaction({
      date: "2026-04-06",
      label: "VERSEMENT ESPECES AGENCE",
      debit: 0,
      credit: 5000,
      balance: 15000,
    })

    expect(result.classification).toBe("cash_deposit")
    expect(result.matched_label).toBe("Dépôt cash")
  })

  it("marque un crédit inconnu comme apport à vérifier", () => {
    const result = classifyBankTransaction({
      date: "2026-04-07",
      label: "VIREMENT RECU OTHMAN",
      debit: 0,
      credit: 8000,
      balance: 23000,
    })

    expect(result.classification).toBe("owner_injection")
    expect(result.review_status).toBe("suggested")
  })
})
