import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createSessionToken, getSessionCookieName, getSessionMaxAge } from "@/lib/server/auth"
import { readDb, verifyPassword } from "@/lib/server/pilot-store"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = String(body?.email || "").trim().toLowerCase()
  const password = String(body?.password || "")

  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 })
  }

  const db = await readDb()
  const user = db.users.find((item) => item.email.toLowerCase() === email)

  if (!user || !verifyPassword(user, password)) {
    return NextResponse.json({ error: "Email ou mot de passe incorrect." }, { status: 401 })
  }

  cookies().set(getSessionCookieName(), createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionMaxAge(),
  })

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    redirectTo: user.role === "admin" ? "/" : "/saisie",
  })
}
