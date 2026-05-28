import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Routes accessibles à l'admin uniquement
const ADMIN_ROUTES = ["/", "/charges", "/objectifs", "/import", "/reporting", "/factures", "/calendrier"]

export async function updateSession(request: NextRequest) {
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
    pathname.startsWith("/reporting") ||
    pathname.startsWith("/factures") ||
    pathname.startsWith("/calendrier")

  // Pas connecté → login
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  // Déjà connecté sur la page login → rediriger selon rôle
  if (user && isLoginPage) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    const role = (profile?.role || "manager") as "admin" | "manager"
    const url = request.nextUrl.clone()
    url.pathname = role === "admin" ? "/" : "/saisie"
    return NextResponse.redirect(url)
  }

  // Vérification admin-only pour les routes sensibles (y compris /)
  const isAdminRoute = ADMIN_ROUTES.some(
    (route) => pathname === route || (route !== "/" && pathname.startsWith(`${route}/`))
  )

  if (user && isAdminRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    const role = (profile?.role || "manager") as "admin" | "manager"

    if (role !== "admin") {
      const url = request.nextUrl.clone()
      url.pathname = "/saisie"
      url.searchParams.set("forbidden", "1")
      return NextResponse.redirect(url)
    }
  }

  return response
}
