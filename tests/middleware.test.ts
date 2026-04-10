import { describe, expect, it, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// Mock @supabase/ssr avant tout import du middleware
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}))

import { createServerClient } from "@supabase/ssr"
import { middleware } from "../middleware"

function makeSupabaseMock(user: { id: string } | null, role: string | null) {
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

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
})

describe("middleware access control", () => {
  it("redirige les anonymes vers /login sur une route protégée", async () => {
    vi.mocked(createServerClient).mockReturnValue(makeSupabaseMock(null, null) as any)
    const request = new NextRequest("http://localhost/charges")
    const response = await middleware(request)
    expect(response.headers.get("location")).toContain("/login")
  })

  it("redirige les anonymes vers /login sur /", async () => {
    vi.mocked(createServerClient).mockReturnValue(makeSupabaseMock(null, null) as any)
    const request = new NextRequest("http://localhost/")
    const response = await middleware(request)
    expect(response.headers.get("location")).toContain("/login")
  })

  it("redirige le manager hors de /reporting (admin-only)", async () => {
    vi.mocked(createServerClient).mockReturnValue(
      makeSupabaseMock({ id: "manager-id" }, "manager") as any
    )
    const request = new NextRequest("http://localhost/reporting")
    const response = await middleware(request)
    expect(response.headers.get("location")).toContain("/saisie")
  })

  it("redirige le manager hors du dashboard / (admin-only)", async () => {
    vi.mocked(createServerClient).mockReturnValue(
      makeSupabaseMock({ id: "manager-id" }, "manager") as any
    )
    const request = new NextRequest("http://localhost/")
    const response = await middleware(request)
    expect(response.headers.get("location")).toContain("/saisie")
  })

  it("laisse l'admin accéder au dashboard /", async () => {
    vi.mocked(createServerClient).mockReturnValue(
      makeSupabaseMock({ id: "admin-id" }, "admin") as any
    )
    const request = new NextRequest("http://localhost/")
    const response = await middleware(request)
    expect(response.headers.get("location")).toBeNull()
  })

  it("laisse l'admin accéder à /reporting", async () => {
    vi.mocked(createServerClient).mockReturnValue(
      makeSupabaseMock({ id: "admin-id" }, "admin") as any
    )
    const request = new NextRequest("http://localhost/reporting")
    const response = await middleware(request)
    expect(response.headers.get("location")).toBeNull()
  })

  it("laisse le manager accéder à /saisie", async () => {
    vi.mocked(createServerClient).mockReturnValue(
      makeSupabaseMock({ id: "manager-id" }, "manager") as any
    )
    const request = new NextRequest("http://localhost/saisie")
    const response = await middleware(request)
    expect(response.headers.get("location")).toBeNull()
  })
})
