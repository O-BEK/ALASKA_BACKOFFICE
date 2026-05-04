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

  it("reconnaît les règles métier connues du restaurant", () => {
    expect(classifyBankTransaction({
      date: "2026-04-10",
      label: "Virement intitulé SALAIRE AVRIL",
      debit: 4000,
      credit: 0,
      balance: 0,
    })).toMatchObject({ classification: "staff_payment", expense_category: "RH", matched_label: "Salaire" })

    expect(classifyBankTransaction({
      date: "2026-04-11",
      label: "PRELEVEMENT WAFASALAF",
      debit: 1200,
      credit: 0,
      balance: 0,
    })).toMatchObject({ classification: "fixed_charge", expense_category: "CHARGES", matched_label: "Crédit moto Wafasalaf" })

    expect(classifyBankTransaction({
      date: "2026-04-12",
      label: "VIREMENT ESTHER BITON",
      debit: 15000,
      credit: 0,
      balance: 0,
    })).toMatchObject({ classification: "fixed_charge", expense_category: "CHARGES", matched_label: "Loyer" })

    expect(classifyBankTransaction({
      date: "2026-04-13",
      label: "Virement reçu de Mohamed Othman Bekri",
      debit: 0,
      credit: 10000,
      balance: 0,
    })).toMatchObject({ classification: "owner_injection", matched_label: "Apport propriétaire" })

    expect(classifyBankTransaction({
      date: "2026-04-14",
      label: "Virement instantané reçu depuis KAYZARAN",
      debit: 0,
      credit: 5000,
      balance: 0,
    })).toMatchObject({ classification: "cash_deposit", matched_label: "Transfert interne BP Kayzaran" })
  })
})
