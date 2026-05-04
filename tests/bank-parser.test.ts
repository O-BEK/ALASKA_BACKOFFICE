import { describe, expect, it } from "vitest"
import { parseBanquePopulaire } from "../lib/bank-parsers/banque-populaire"
import { parseCfg } from "../lib/bank-parsers/cfg"

const BP_SAMPLE = [
  "01/01/2026  VERSEMENT ESPECES                                  5,000.00      50,000.00",
  "05/01/2026  VIREMENT FOURNISSEUR ALI                2,000.00                 48,000.00",
  "15/01/2026  REMISE CHEQUE                                      3,500.00      51,500.00",
  "20/01/2026  PRELEVEMENT LOYER                       8,000.00                 43,500.00",
].join("\n")

const CFG_SAMPLE = [
  "02/01/2026  REMISE ESPECES              +4,500.00       60,000.00",
  "08/01/2026  VIREMENT EMIS FOURNISSEUR   -3,000.00       57,000.00",
  "18/01/2026  VIREMENT RECU CLIENT        +7,000.00       64,000.00",
].join("\n")

const CFG_CAPTURE_SAMPLE = [
  "17/04/2026  17/04/2026 205341474 Frais VI                                      12,00        9 988,00",
  "18/04/2026  18/04/2026 205428376 Virement reçu 050 810 KAYZARAN                            5 000,00      14 988,00",
  "21/04/2026  21/04/2026 205900001 Virement instantané émis ESTHER BITON         15 000,00                    12 000,00",
].join("\n")

describe("parseBanquePopulaire", () => {
  it("extrait les transactions du texte brut", () => {
    const result = parseBanquePopulaire(BP_SAMPLE)
    expect(result.bank).toBe("bp")
    expect(result.transactions.length).toBe(4)
  })

  it("parse correctement les dates en YYYY-MM-DD", () => {
    const result = parseBanquePopulaire(BP_SAMPLE)
    expect(result.transactions[0].date).toBe("2026-01-01")
    expect(result.transactions[1].date).toBe("2026-01-05")
  })

  it("sépare débit et crédit", () => {
    const result = parseBanquePopulaire(BP_SAMPLE)
    expect(result.transactions[0].credit).toBe(5000)
    expect(result.transactions[0].debit).toBe(0)
    expect(result.transactions[1].debit).toBe(2000)
    expect(result.transactions[1].credit).toBe(0)
  })

  it("calcule period_start et period_end", () => {
    const result = parseBanquePopulaire(BP_SAMPLE)
    expect(result.period_start).toBe("2026-01-01")
    expect(result.period_end).toBe("2026-01-20")
  })
})

describe("parseCfg", () => {
  it("extrait les transactions du format signé", () => {
    const result = parseCfg(CFG_SAMPLE)
    expect(result.bank).toBe("cfg")
    expect(result.transactions.length).toBe(3)
  })

  it("convertit les montants signés en débit/crédit", () => {
    const result = parseCfg(CFG_SAMPLE)
    expect(result.transactions[0].credit).toBe(4500)
    expect(result.transactions[0].debit).toBe(0)
    expect(result.transactions[1].debit).toBe(3000)
    expect(result.transactions[1].credit).toBe(0)
  })

  it("parse correctement les dates", () => {
    const result = parseCfg(CFG_SAMPLE)
    expect(result.transactions[0].date).toBe("2026-01-02")
  })

  it("nettoie la date répétée du libellé et récupère les montants CFG extraits en colonnes", () => {
    const result = parseCfg(CFG_CAPTURE_SAMPLE)

    expect(result.transactions).toHaveLength(3)
    expect(result.transactions[0]).toMatchObject({
      date: "2026-04-17",
      label: "205341474 Frais VI",
      debit: 12,
      credit: 0,
      balance: 9988,
    })
    expect(result.transactions[1]).toMatchObject({
      label: "205428376 Virement reçu 050 810 KAYZARAN",
      debit: 0,
      credit: 5000,
      balance: 14988,
    })
    expect(result.transactions[2]).toMatchObject({
      label: "205900001 Virement instantané émis ESTHER BITON",
      debit: 15000,
      credit: 0,
      balance: 12000,
    })
  })
})
