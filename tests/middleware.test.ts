import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { middleware } from "../middleware"

function sessionCookie(role: "admin" | "manager") {
  const payload = Buffer.from(
    JSON.stringify({
      userId: role,
      email: `${role}@alaska.ma`,
      name: role,
      role,
      expiresAt: Date.now() + 60_000,
    })
  ).toString("base64url")
  return `alaska_session=${payload}.demo`
}

describe("middleware access control", () => {
  it("redirects anonymous users to /login", async () => {
    const request = new NextRequest("http://localhost/charges")
    const response = await middleware(request)
    expect(response.headers.get("location")).toContain("/login")
  })

  it("redirects manager away from admin pages", async () => {
    const request = new NextRequest("http://localhost/reporting", {
      headers: { cookie: sessionCookie("manager") },
    })
    const response = await middleware(request)
    expect(response.headers.get("location")).toContain("/saisie")
  })

  it("lets admin access admin pages", async () => {
    const request = new NextRequest("http://localhost/reporting", {
      headers: { cookie: sessionCookie("admin") },
    })
    const response = await middleware(request)
    expect(response.headers.get("location")).toBeNull()
  })
})
