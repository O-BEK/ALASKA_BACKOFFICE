#!/usr/bin/env node

/**
 * Validation V1 staging.
 *
 * Usage :
 *   node --env-file=.env.local scripts/validate-v1-staging.mjs
 */

import { createClient } from "@supabase/supabase-js"

const requiredEnv = [
  "STAGING_URL",
  "ALASKA_ADMIN_EMAIL",
  "ALASKA_ADMIN_PASSWORD",
  "ALASKA_MANAGER_EMAIL",
  "ALASKA_MANAGER_PASSWORD",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
]

const missingEnv = requiredEnv.filter((key) => !process.env[key]?.trim())
if (missingEnv.length > 0) {
  console.error("Variables manquantes pour la validation staging :")
  missingEnv.forEach((key) => console.error(` - ${key}`))
  process.exit(1)
}

const stagingUrl = process.env.STAGING_URL.replace(/\/+$/, "")
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const today = new Date().toISOString().slice(0, 10)
let hasFailure = false
let adminToken = ""
let managerToken = ""

async function runCheck(label, check) {
  try {
    await check()
    console.log(`✅ ${label}`)
  } catch (error) {
    hasFailure = true
    const message = error instanceof Error ? error.message : String(error)
    console.error(`❌ ${label}`)
    console.error(`   ${message}`)
  }
}

async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  if (!data.session?.access_token) throw new Error("Aucun access_token retourne par Supabase Auth.")
  return data.session.access_token
}

async function expectApiStatus(path, token, expectedStatus) {
  const url = new URL(path, stagingUrl)
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      Accept: "application/json",
    },
  })

  if (response.status !== expectedStatus) {
    const body = await response.text().catch(() => "")
    throw new Error(`HTTP ${response.status}, attendu ${expectedStatus}${body ? ` - ${body.slice(0, 300)}` : ""}`)
  }
}

await runCheck("Login admin via Supabase Auth -> token valide", async () => {
  adminToken = await login(process.env.ALASKA_ADMIN_EMAIL, process.env.ALASKA_ADMIN_PASSWORD)
})

await runCheck("Login manager via Supabase Auth -> token valide", async () => {
  managerToken = await login(process.env.ALASKA_MANAGER_EMAIL, process.env.ALASKA_MANAGER_PASSWORD)
})

await runCheck("GET /api/dashboard avec token admin -> 200", async () => {
  await expectApiStatus("/api/dashboard", adminToken, 200)
})

await runCheck("GET /api/dashboard avec token manager -> 403", async () => {
  await expectApiStatus("/api/dashboard", managerToken, 403)
})

await runCheck("GET /api/charges avec token manager -> 403", async () => {
  await expectApiStatus("/api/charges", managerToken, 403)
})

await runCheck("GET /api/reporting avec token manager -> 403", async () => {
  await expectApiStatus("/api/reporting", managerToken, 403)
})

await runCheck("GET /api/daily-entry?date=TODAY avec token manager -> 200", async () => {
  await expectApiStatus(`/api/daily-entry?date=${today}`, managerToken, 200)
})

await runCheck("GET /api/week?start=TODAY avec token manager -> 200", async () => {
  await expectApiStatus(`/api/week?start=${today}`, managerToken, 200)
})

if (hasFailure) {
  process.exit(1)
}

console.log("Validation staging V1 terminee.")
