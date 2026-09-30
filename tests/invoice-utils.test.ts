import { describe, it, expect } from "vitest"
import { buildInvoiceNumber } from "../lib/server/invoice-utils"

describe("buildInvoiceNumber", () => {
  it("continues after the last pre-app invoice", () => {
    expect(buildInvoiceNumber([])).toBe("FAC202531")
  })
  it("increments the highest number in the historical series", () => {
    expect(buildInvoiceNumber(["FAC202531", "FAC202532"])).toBe("FAC202533")
  })
  it("ignores invoice numbers from the old app format", () => {
    expect(buildInvoiceNumber(["FAC-2026-008"])).toBe("FAC202531")
  })
  it("uses the numeric maximum rather than lexical ordering", () => {
    expect(buildInvoiceNumber(["FAC202599", "FAC2025100"])).toBe("FAC2025101")
  })
  it("reuses the last number after the latest invoice is removed", () => {
    expect(buildInvoiceNumber(["FAC202531"])).toBe("FAC202532")
    expect(buildInvoiceNumber([])).toBe("FAC202531")
  })
})
