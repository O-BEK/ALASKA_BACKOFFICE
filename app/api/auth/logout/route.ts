import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getSessionCookieName } from "@/lib/server/auth"

export async function POST() {
  cookies().set(getSessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  })

  return NextResponse.json({ ok: true })
}
