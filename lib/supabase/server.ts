import { cookies, headers } from "next/headers"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

export function createClient() {
  const cookieStore = cookies()
  const authorization = headers().get("authorization")

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options })
          } catch {}
        },
      },
      global: authorization
        ? {
            headers: {
              Authorization: authorization,
            },
          }
        : undefined,
    }
  )
}

/**
 * Get the user's role from the profiles table (secure server-side check).
 * Returns the role if the user exists in profiles, otherwise null.
 */
export async function getUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<"admin" | "manager" | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single()

    if (error || !data) return null
    return data.role
  } catch {
    return null
  }
}

/**
 * Check if the user is an admin (from profiles table).
 */
export async function isAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const role = await getUserRole(supabase, userId)
  return role === "admin"
}
