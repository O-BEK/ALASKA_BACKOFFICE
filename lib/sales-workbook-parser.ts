import * as XLSX from "xlsx"
import { parseSalesRows, type ParsedDay } from "@/lib/csv-parser"

export function parseSalesWorkbook(input: Buffer | ArrayBuffer | Uint8Array): ParsedDay[] {
  const workbook = XLSX.read(input, { type: "buffer", cellDates: true })
  let lastError: unknown = null

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: "" })
    try {
      const parsed = parseSalesRows(rows)
      if (parsed.length > 0) return parsed
    } catch (error) {
      lastError = error
    }
  }

  if (lastError instanceof Error) throw lastError
  throw new Error("Format Excel non reconnu")
}
