import { describe, expect, it } from "vitest"
import * as XLSX from "xlsx"
import { parseSalesWorkbook } from "../lib/sales-workbook-parser"

describe("parseSalesWorkbook", () => {
  it("aggregates POS sales from an Excel workbook", () => {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        Date: "07/04/2026",
        Heure: "18:30",
        "Num ticket": "T1",
        "Prix de vente": "100",
        "Quantité": "1",
        "Moyens de paiements": "Espèces",
      },
      {
        Date: "07/04/2026",
        Heure: "20:15",
        "Num ticket": "T2",
        "Prix de vente": "50",
        "Quantité": "2",
        "Moyens de paiements": "CB",
      },
      {
        Date: "07/04/2026",
        Heure: "11:00",
        Type: "Mouvement de caisse",
        "Prix de vente": "25",
        "Quantité": "1",
      },
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ventes")
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

    const parsed = parseSalesWorkbook(buffer)

    expect(parsed).toEqual([
      {
        date: "2026-04-07",
        ca_caisse: 100,
        ca_b2b: 100,
        ca_soir: 100,
        pct_soir: 50,
        tickets_count: 2,
        mouvement_caisse: 25,
      },
    ])
  })
})
