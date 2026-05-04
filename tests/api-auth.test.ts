import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
  headers: vi.fn(() => ({
    get: vi.fn(),
  })),
}))

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ admin: true })),
}))

vi.mock("@/lib/server/supabase-store", () => ({
  getDailyEntry: vi.fn(),
  readSnapshot: vi.fn(),
}))

vi.mock("@/lib/server/analytics", () => ({
  buildDashboardData: vi.fn(() => ({ ok: true })),
  buildLastSixMonths: vi.fn(() => []),
  buildWeekData: vi.fn(() => ({ ok: true })),
  buildWeekEntries: vi.fn(() => []),
  monthReporting: vi.fn(() => ({ ok: true })),
  buildBankConsolidation: vi.fn(() => ({ has_data: false, banks: [], total_debit: 0, total_credit: 0, import_count: 0 })),
}))

vi.mock("@/lib/server/bank-store", () => ({
  listBankImports: vi.fn(() => []),
  getBankTransactions: vi.fn(() => []),
  saveBankImport: vi.fn(),
  saveBankTransactions: vi.fn(),
  deleteBankImport: vi.fn(),
  getBankTransactionsByPeriod: vi.fn(() => []),
}))

vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn(),
}))

import { createServerClient } from "@supabase/ssr"
import { getDailyEntry, readSnapshot } from "@/lib/server/supabase-store"

function makeSupabaseMock(user: { id: string } | null, role: "admin" | "manager" | null) {
  const profileData = role ? { role } : null

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: profileData, error: null }),
    }),
  }
}

async function expectManagerStatus(
  importer: () => Promise<{ GET: (request: Request) => Promise<Response> }>,
  url: string,
  status: number
) {
  vi.mocked(createServerClient).mockReturnValue(
    makeSupabaseMock({ id: "manager-id" }, "manager") as any
  )

  const { GET } = await importer()
  const response = await GET(new Request(url))

  expect(response.status).toBe(status)
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
  vi.mocked(getDailyEntry).mockResolvedValue({ date: "2026-04-14" } as any)
  vi.mocked(readSnapshot).mockResolvedValue({} as any)
})

describe("API route authorization", () => {
  it("retourne 403 pour un manager sur GET /api/dashboard", async () => {
    await expectManagerStatus(
      () => import("../app/api/dashboard/route"),
      "http://localhost/api/dashboard?month=2026-04",
      403
    )
  })

  it("retourne 403 pour un manager sur GET /api/charges", async () => {
    await expectManagerStatus(
      () => import("../app/api/charges/route"),
      "http://localhost/api/charges",
      403
    )
  })

  it("retourne 403 pour un manager sur GET /api/reporting", async () => {
    await expectManagerStatus(
      () => import("../app/api/reporting/route"),
      "http://localhost/api/reporting?month=2026-04",
      403
    )
  })

  it("retourne 403 pour un manager sur GET /api/objectives", async () => {
    await expectManagerStatus(
      () => import("../app/api/objectives/route"),
      "http://localhost/api/objectives",
      403
    )
  })

  it("retourne 200 pour un manager sur GET /api/daily-entry", async () => {
    await expectManagerStatus(
      () => import("../app/api/daily-entry/route"),
      "http://localhost/api/daily-entry?date=2026-04-14",
      200
    )
  })

  it("retourne 200 pour un manager sur GET /api/week", async () => {
    await expectManagerStatus(
      () => import("../app/api/week/route"),
      "http://localhost/api/week?start=2026-04-13",
      200
    )
  })

  it("retourne 403 pour un manager sur GET /api/bank-statements", async () => {
    await expectManagerStatus(
      () => import("../app/api/bank-statements/route"),
      "http://localhost/api/bank-statements",
      403
    )
  })

  it("retourne 403 pour un manager sur GET /api/bank-statements/[id]", async () => {
    vi.mocked(createServerClient).mockReturnValue(
      makeSupabaseMock({ id: "manager-id" }, "manager") as any
    )
    const { GET } = await import("../app/api/bank-statements/[id]/route")
    const response = await GET(
      new Request("http://localhost/api/bank-statements/fake-id"),
      { params: { id: "fake-id" } }
    )
    expect(response.status).toBe(403)
  })
})
