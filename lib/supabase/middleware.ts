import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const ADMIN_ROUTES = ["/charges", "/objectifs", "/import", "/reporting"]

function fallbackUserFromLegacyCookie(request: NextRequest) {
  const raw = request.cookies.get("alaska_session")?.value
  if (!raw) return null

  try {
    const [payload] = raw.split(".")
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
    const decoded = JSON.parse(atob(padded)) as {
      email?: string
      name?: string
      role?: "admin" | "manager"
    }

    if (decoded.role !== "admin" && decoded.role !== "manager") return null
    return {
      email: decoded.email || "",
      name: decoded.name || "Utilisateur",
      user_metadata: { role: decoded.role },
    }
  } catch {
    return null
  }
}

export async function updateSession(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const user = fallbackUserFromLegacyCookie(request)
    const pathname = request.nextUrl.pathname
    const isLoginPage = pathname.startsWith("/login")
    const isProtectedRoute =
      pathname === "/" ||
      pathname.startsWith("/saisie") ||
      pathname.startsWith("/semaine") ||
      pathname.startsWith("/charges") ||
      pathname.startsWith("/objectifs") ||
      pathname.startsWith("/import") ||
      pathname.startsWith("/reporting")

    if (!user && isProtectedRoute) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("redirect", pathname)
      return NextResponse.redirect(url)
    }

    if (user && isLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = user.user_metadata.role === "admin" ? "/" : "/saisie"
      return NextResponse.redirect(url)
    }

    const isAdminRoute = ADMIN_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
    if (user && isAdminRoute && user.user_metadata.role !== "admin") {
      const url = request.nextUrl.clone()
      url.pathname = "/saisie"
      url.searchParams.set("forbidden", "1")
      return NextResponse.redirect(url)
    }

    return NextResponse.next({ request: { headers: request.headers } })
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: "", ...options })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname.startsWith("/login")
  const isProtectedRoute =
    pathname === "/" ||
    pathname.startsWith("/saisie") ||
    pathname.startsWith("/semaine") ||
    pathname.startsWith("/charges") ||
    pathname.startsWith("/objectifs") ||
    pathname.startsWith("/import") ||
    pathname.startsWith("/reporting")

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const role = (user.user_metadata?.role || "manager") as "admin" | "manager"
    const url = request.nextUrl.clone()
    url.pathname = role === "admin" ? "/" : "/saisie"
    return NextResponse.redirect(url)
  }

  const isAdminRoute = ADMIN_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  const role = (user?.user_metadata?.role || "manager") as "admin" | "manager"

  if (user && isAdminRoute && role !== "admin") {
    const url = request.nextUrl.clone()
    url.pathname = "/saisie"
    url.searchParams.set("forbidden", "1")
    return NextResponse.redirect(url)
  }

  return response
}
