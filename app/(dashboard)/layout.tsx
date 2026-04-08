import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppShell } from "@/components/layout/AppShell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return (
    <AppShell
      user={{
        email: user.email || "",
        name: user.user_metadata?.name || user.email?.split("@")[0] || "Utilisateur",
        role: (user.user_metadata?.role || "manager") as "admin" | "manager",
      }}
    >
      {children}
    </AppShell>
  )
}
