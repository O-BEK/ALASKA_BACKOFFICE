import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppShell } from "@/components/layout/AppShell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .single()

  const role = (profile?.role || "manager") as "admin" | "manager"
  const name = profile?.name || user.email?.split("@")[0] || "Utilisateur"

  return (
    <AppShell
      user={{
        email: user.email || "",
        name,
        role,
      }}
    >
      {children}
    </AppShell>
  )
}
