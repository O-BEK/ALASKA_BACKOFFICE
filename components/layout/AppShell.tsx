"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { CalendarDays, Edit3, FileBarChart, Home, LogOut, Menu, Target, UploadCloud, X, Calculator } from "lucide-react"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"

const navByRole: Record<UserRole, { href: string; label: string; icon: any }[]> = {
  admin: [
    { href: "/", icon: Home, label: "Dashboard" },
    { href: "/saisie", icon: Edit3, label: "Caisse" },
    { href: "/semaine", icon: CalendarDays, label: "Semaine" },
    { href: "/charges", icon: Calculator, label: "Charges" },
    { href: "/objectifs", icon: Target, label: "Objectifs" },
    { href: "/import", icon: UploadCloud, label: "Import CSV" },
    { href: "/reporting", icon: FileBarChart, label: "Reporting" },
  ],
  manager: [
    { href: "/saisie", icon: Edit3, label: "Caisse" },
    { href: "/semaine", icon: CalendarDays, label: "Semaine" },
  ],
}

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode
  user: { email: string; name: string; role: UserRole }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navItems = navByRole[user.role] ?? navByRole.manager

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-alaska-cream flex flex-col md:flex-row">
      <aside className="hidden md:flex flex-col w-56 bg-alaska-dark text-white min-h-screen flex-shrink-0">
        <div className="p-4 flex items-center justify-center border-b border-white/10">
          <Image src="/logo.png" alt="Alaska Neo Bistrot" width={120} height={120} className="object-contain" />
        </div>
        <SidebarContent
          pathname={pathname}
          navItems={navItems}
          user={user}
          onNavigate={() => setMobileOpen(false)}
          onSignOut={signOut}
        />
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-alaska-dark text-white flex flex-col h-full z-50">
            <div className="p-4 flex items-center justify-between border-b border-white/10">
              <Image src="/logo.png" alt="Alaska Neo Bistrot" width={80} height={80} className="object-contain" />
              <button onClick={() => setMobileOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg">
                <X size={18} className="text-alaska-muted" />
              </button>
            </div>
            <SidebarContent
              pathname={pathname}
              navItems={navItems}
              user={user}
              onNavigate={() => setMobileOpen(false)}
              onSignOut={signOut}
            />
          </aside>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden bg-alaska-dark text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <Image src="/logo.png" alt="Alaska Neo Bistrot" width={36} height={36} className="object-contain" />
          <button onClick={() => setMobileOpen(true)} className="p-1.5 hover:bg-white/10 rounded-lg">
            <Menu size={20} />
          </button>
        </header>
        <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">{children}</div>
      </main>
    </div>
  )
}

function SidebarContent({
  pathname,
  navItems,
  user,
  onNavigate,
  onSignOut,
}: {
  pathname: string
  navItems: { href: string; label: string; icon: any }[]
  user: { email: string; name: string; role: UserRole }
  onNavigate: () => void
  onSignOut: () => void
}) {
  return (
    <>
      <nav className="flex-1 p-3 space-y-0.5 mt-2">
        {navItems.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition",
              pathname === href ? "bg-alaska-sage text-white font-medium" : "text-alaska-muted hover:bg-white/5 hover:text-white"
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10 space-y-1">
        <p className="text-xs text-alaska-muted px-3 truncate">{user.email}</p>
        <p className="text-[10px] text-alaska-muted/60 px-3">{user.role === "admin" ? "Admin" : "Manager"}</p>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-alaska-muted hover:bg-white/5 hover:text-white transition mt-2"
        >
          <LogOut size={15} /> Déconnexion
        </button>
      </div>
    </>
  )
}
