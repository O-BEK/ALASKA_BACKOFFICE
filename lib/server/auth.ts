import "server-only"

import crypto from "crypto"
import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import type { AppUser } from "@/lib/server/pilot-store"
import { readDb } from "@/lib/server/pilot-store"
import type { UserRole } from "@/lib/types"

const SESSION_COOKIE = "alaska_session"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function getSecret() {
  return process.env.ALASKA_AUTH_SECRET || "alaska-pilot-internal-secret"
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex")
}

export interface AuthSession {
  userId: string
  email: string
  name: string
  role: UserRole
  expiresAt: number
}

export function createSessionToken(user: AppUser) {
  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    expiresAt: Date.now() + MAX_AGE_SECONDS * 1000,
  } satisfies AuthSession
  const raw = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${raw}.${sign(raw)}`
}

function parseToken(token: string | undefined | null): AuthSession | null {
  if (!token) return null
  const [raw, signature] = token.split(".")
  if (!raw || !signature || sign(raw) !== signature) return null

  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as AuthSession
    if (parsed.expiresAt <= Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

export function getSessionFromRequest(request: NextRequest) {
  return parseToken(request.cookies.get(SESSION_COOKIE)?.value)
}

export function getSession() {
  return parseToken(cookies().get(SESSION_COOKIE)?.value)
}

export async function getCurrentUser() {
  const session = getSession()
  if (!session) return null
  const db = await readDb()
  const user = db.users.find((item) => item.id === session.userId)
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  }
}

export function getSessionCookieName() {
  return SESSION_COOKIE
}

export function getSessionMaxAge() {
  return MAX_AGE_SECONDS
}
