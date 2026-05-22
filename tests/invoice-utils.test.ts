import { describe, it, expect } from "vitest"
import { buildInvoiceNumber } from "../lib/server/invoice-utils"

describe("buildInvoiceNumber", () => {
  it("returns FAC-YYYY-001 when no previous invoice exists", () => {
    expect(buildInvoiceNumber(2026, null)).toBe("FAC-2026-001")
  })
  it("increments from 001 to 002", () => {
    expect(buildInvoiceNumber(2026, "FAC-2026-001")).toBe("FAC-2026-002")
  })
  it("increments from 009 to 010", () => {
    expect(buildInvoiceNumber(2026, "FAC-2026-009")).toBe("FAC-2026-010")
  })
  it("increments from 099 to 100 (no padding truncation)", () => {
    expect(buildInvoiceNumber(2026, "FAC-2026-099")).toBe("FAC-2026-100")
  })
  it("uses a different year prefix", () => {
    expect(buildInvoiceNumber(2027, null)).toBe("FAC-2027-001")
  })
  it("pads sequence numbers below 100 to 3 digits", () => {
    expect(buildInvoiceNumber(2026, "FAC-2026-010")).toBe("FAC-2026-011")
  })
})
