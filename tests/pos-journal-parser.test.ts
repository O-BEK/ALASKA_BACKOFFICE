import { describe, expect, it } from "vitest"
import { parseCashJournalRows } from "../lib/pos-journal-parser"

describe("parseCashJournalRows", () => {
  it("consolidates a single-row journal day", () => {
    const parsed = parseCashJournalRows([
      {
        "DATE OUVERTURE": "12-04-2026 10:00:00",
        "FOND DE CAISSE OUVERTURE": "1500",
        "DATE FERMETURE": "12-04-2026 23:30:00",
        "FOND DE CAISSE CONSTATÉ": "3100",
        "VENTES EN ESPÈCES": "1700",
        "MOUVEMENTS DE CAISSE": "-100",
      },
    ])

    expect(parsed).toEqual([
      {
        date: "2026-04-12",
        cash_sales_journal: 1700,
        cash_movements_journal: -100,
        cash_opening_fund: 1500,
        cash_closing_fund: 3100,
        cash_journal_sessions: 1,
        cash_journal_anomaly: false,
      },
    ])
  })

  it("consolidates multi-session days and keeps the last non-zero closing fund", () => {
    const parsed = parseCashJournalRows([
      {
        "DATE OUVERTURE": "01-04-2026 22:49:07",
        "FOND DE CAISSE OUVERTURE": "1500",
        "DATE FERMETURE": "02-04-2026 00:15:55",
        "FOND DE CAISSE CONSTATÉ": "3006",
        "VENTES EN ESPÈCES": "1699",
        "MOUVEMENTS DE CAISSE": "-184",
      },
      {
        "DATE OUVERTURE": "01-04-2026 20:00:00",
        "FOND DE CAISSE OUVERTURE": "0",
        "DATE FERMETURE": "02-04-2026 00:18:00",
        "FOND DE CAISSE CONSTATÉ": "0",
        "VENTES EN ESPÈCES": "0",
        "MOUVEMENTS DE CAISSE": "-40",
      },
    ])

    expect(parsed).toEqual([
      {
        date: "2026-04-02",
        cash_sales_journal: 1699,
        cash_movements_journal: -224,
        cash_opening_fund: 0,
        cash_closing_fund: 3006,
        cash_journal_sessions: 2,
        cash_journal_anomaly: true,
      },
    ])
  })
})
