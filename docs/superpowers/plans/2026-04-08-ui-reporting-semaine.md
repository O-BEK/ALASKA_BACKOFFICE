# UI Redesign + Reporting + Page Semaine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refonte complète de l'UI Alaska (design system + 7 pages) + implémentation Reporting (4 sections Recharts) + page /semaine fonctionnelle.

**Architecture:** Design tokens dans tailwind.config.ts + fonts Next.js → propagation automatique via classes Tailwind. Pages reécrites (visual-only sauf Reporting et Semaine qui lisent localStorage). Composant `ExpenseBar` partagé entre Reporting et Semaine.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, shadcn/ui, Recharts, date-fns, localStorage via `getLocalEntries()`

---

## File Structure

| Fichier | Action |
|---|---|
| `claude/tailwind.config.ts` | Modifier — nouvelle palette alaska + fontFamily |
| `claude/app/layout.tsx` | Modifier — Playfair Display + DM Sans |
| `claude/app/globals.css` | Modifier — fond crème + variables |
| `claude/app/(dashboard)/layout.tsx` | Modifier — sidebar dark + mobile bottom nav |
| `claude/app/(dashboard)/page.tsx` | Modifier — redesign visual Alaska |
| `claude/app/(dashboard)/saisie/page.tsx` | Modifier — polish visuel |
| `claude/app/(dashboard)/charges/page.tsx` | Modifier — polish visuel |
| `claude/app/(dashboard)/objectifs/page.tsx` | Modifier — polish visuel |
| `claude/app/(dashboard)/import/page.tsx` | Modifier — polish visuel |
| `claude/components/ExpenseBar.tsx` | Créer — barres horizontales réutilisables |
| `claude/app/(dashboard)/reporting/page.tsx` | Modifier — refaire entièrement (4 sections) |
| `claude/app/(dashboard)/semaine/page.tsx` | Modifier — implémenter entièrement |

---

## Task 1: Design Tokens

**Files:**
- Modify: `claude/tailwind.config.ts`
- Modify: `claude/app/layout.tsx`
- Modify: `claude/app/globals.css`

- [ ] **Step 1: Update tailwind.config.ts**

```ts
import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        alaska: {
          sage:      "#4a6741",
          cream:     "#f5f0e8",
          dark:      "#1a1a16",
          gold:      "#c9a96e",
          muted:     "#7a7a6a",
          "sage-lt": "#e8ede7",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      fontFamily: {
        playfair: ["var(--font-playfair)", "serif"],
        sans: ["var(--font-sans)", "sans-serif"],
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
export default config
```

- [ ] **Step 2: Update app/layout.tsx**

```tsx
import type { Metadata } from "next"
import { Playfair_Display, DM_Sans } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" })
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "Alaska Pilot",
  description: "Pilotage Alaska Neo Bistrot",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-alaska-cream font-sans antialiased", playfair.variable, dmSans.variable)}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Update app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 43 38% 93%;
    --foreground: 60 6% 10%;
    --card: 0 0% 100%;
    --card-foreground: 60 6% 10%;
    --primary: 120 21% 27%;
    --primary-foreground: 0 0% 100%;
    --secondary: 100 14% 91%;
    --secondary-foreground: 60 6% 10%;
    --muted: 100 14% 91%;
    --muted-foreground: 60 3% 46%;
    --accent: 100 14% 91%;
    --accent-foreground: 60 6% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 100 14% 85%;
    --input: 100 14% 85%;
    --ring: 120 21% 27%;
    --radius: 0.75rem;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-alaska-cream text-foreground; }
}
```

- [ ] **Step 4: Verify build**

```bash
cd claude && npm run build
```

Expected: compiled successfully, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add claude/tailwind.config.ts claude/app/layout.tsx claude/app/globals.css
git commit -m "feat: Alaska design tokens — colors, Playfair+DM Sans fonts"
```

---

## Task 2: Dashboard Layout Redesign

**Files:**
- Modify: `claude/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Rewrite layout.tsx**

```tsx
"use client"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Home, Edit3, CalendarDays, Calculator, Target, UploadCloud, FileBarChart, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

const adminNav = [
  { href: "/",          icon: Home,         label: "Dashboard",  adminOnly: true },
  { href: "/saisie",    icon: Edit3,         label: "Saisie",     adminOnly: false },
  { href: "/semaine",   icon: CalendarDays,  label: "Semaine",    adminOnly: false },
  { href: "/charges",   icon: Calculator,    label: "Charges",    adminOnly: true },
  { href: "/objectifs", icon: Target,        label: "Objectifs",  adminOnly: true },
  { href: "/import",    icon: UploadCloud,   label: "Import CSV", adminOnly: true },
  { href: "/reporting", icon: FileBarChart,  label: "Reporting",  adminOnly: true },
]

const mobileNav = [
  { href: "/",          icon: Home,         label: "Dashboard" },
  { href: "/saisie",    icon: Edit3,         label: "Saisie" },
  { href: "/semaine",   icon: CalendarDays,  label: "Semaine" },
  { href: "/reporting", icon: FileBarChart,  label: "Reporting" },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    setRole("admin")
  }, [pathname, router])

  const signOut = () => {
    localStorage.removeItem("alaska_user")
    router.push("/login")
  }

  if (!role) return null

  const navItems = adminNav.filter(n => !n.adminOnly || role === "admin")

  return (
    <div className="min-h-screen bg-alaska-cream flex flex-col md:flex-row">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-alaska-dark text-white min-h-screen flex-shrink-0">
        <div className="p-5 flex items-center gap-2 border-b border-white/10">
          <span className="text-lg">🐟</span>
          <div>
            <p className="font-playfair font-bold text-sm text-white leading-tight">Alaska</p>
            <p className="text-[10px] text-alaska-muted leading-tight">Pilotage</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 mt-2">
          {navItems.map(({ href, icon: Icon, label, adminOnly }) => {
            const isActive = pathname === href
            if (adminOnly && label === "Charges") {
              return (
                <div key="admin-sep">
                  <div className="my-3 border-t border-alaska-gold/30"/>
                  <p className="text-[9px] font-semibold text-alaska-gold/60 uppercase tracking-widest px-3 mb-1.5">Administration</p>
                  <NavLink href={href} icon={Icon} label={label} active={isActive}/>
                </div>
              )
            }
            return <NavLink key={href} href={href} icon={Icon} label={label} active={isActive}/>
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-1">
          <p className="text-xs text-alaska-muted px-3 truncate">othman@alaska.ma</p>
          <p className="text-[10px] text-alaska-muted/60 px-3">Admin</p>
          <button onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-alaska-muted hover:bg-white/5 hover:text-white transition mt-2">
            <LogOut size={15}/> Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Mobile header */}
        <header className="md:hidden bg-alaska-dark text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span>🐟</span>
            <span className="font-playfair font-bold text-sm">Alaska</span>
          </div>
          <button onClick={signOut} className="p-1.5 bg-white/10 rounded-lg">
            <LogOut size={15}/>
          </button>
        </header>

        <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>

      {/* Bottom Nav Mobile */}
      <nav className="md:hidden fixed bottom-0 w-full bg-alaska-dark h-16 flex justify-around items-center z-20">
        {mobileNav.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href
          return (
            <Link key={href} href={href}
              className={cn("flex flex-col items-center gap-1 px-4 py-2 transition",
                isActive ? "text-alaska-sage" : "text-alaska-muted hover:text-white")}>
              <Icon size={20}/>
              <span className="text-[10px]">{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

function NavLink({ href, icon: Icon, label, active }: { href: string; icon: any; label: string; active: boolean }) {
  return (
    <Link href={href}
      className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition",
        active ? "bg-alaska-sage text-white font-medium" : "text-alaska-muted hover:bg-white/5 hover:text-white")}>
      <Icon size={16}/>
      {label}
    </Link>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd claude && npm run build
```

Expected: compiled successfully.

- [ ] **Step 3: Commit**

```bash
git add "claude/app/(dashboard)/layout.tsx"
git commit -m "feat: layout — dark sidebar alaska-dark, gold separator, mobile bottom nav"
```

---

## Task 3: Dashboard Visual Redesign

**Files:**
- Modify: `claude/app/(dashboard)/page.tsx`

- [ ] **Step 1: Rewrite dashboard page.tsx**

```tsx
"use client"
import { useState } from "react"
import { useDashboard } from "@/lib/hooks/useDashboard"
import { ACTION_ITEMS, IMPORT_HISTORY } from "@/lib/mock-data"
import { formatMAD, formatPct } from "@/lib/utils"
import { getBreakevenColor } from "@/lib/calculations"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Activity, Target,
  ChevronLeft, ChevronRight, UploadCloud, Edit3, FileBarChart, AlertTriangle
} from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import Link from "next/link"
import { cn } from "@/lib/utils"

const MONTHS_FR = ["Jan","Fév","Mars","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]
function monthLabel(m: string) { const [,mo] = m.split("-"); return MONTHS_FR[parseInt(mo)-1] }

const LEVER_COLORS: Record<string, string> = {
  soir: "bg-alaska-sage text-white",
  terrasse: "bg-alaska-gold text-white",
  b2b: "bg-amber-500 text-white",
  marketing: "bg-blue-500 text-white",
  pilotage: "bg-purple-500 text-white",
}

export default function DashboardPage() {
  const [month, setMonth] = useState("2026-04")
  const { kpis, delta_ca, last12 } = useDashboard(month)

  const prevMonth = () => {
    const [y, m] = month.split("-").map(Number)
    setMonth(m === 1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,"0")}`)
  }
  const nextMonth = () => {
    const [y, m] = month.split("-").map(Number)
    setMonth(m === 12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,"0")}`)
  }

  const bColor = getBreakevenColor(kpis.pct_breakeven)
  const topActions = ACTION_ITEMS.filter(a => a.status !== "done").slice(0, 3)
  const csvMissing = !IMPORT_HISTORY.some(i => i.date_range_start.startsWith(month))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Bonjour Othman</h1>
          <p className="text-alaska-muted text-sm mt-0.5">Tableau de bord — Alaska Neo Bistrot</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-alaska-sage-lt rounded-lg p-1">
          <button onClick={prevMonth} className="p-1.5 hover:bg-alaska-sage-lt rounded-md transition"><ChevronLeft size={16}/></button>
          <span className="text-sm font-semibold px-2 min-w-[90px] text-center text-alaska-dark">
            {MONTHS_FR[parseInt(month.split("-")[1])-1]} {month.split("-")[0]}
          </span>
          <button onClick={nextMonth} className="p-1.5 hover:bg-alaska-sage-lt rounded-md transition"><ChevronRight size={16}/></button>
        </div>
      </div>

      {csvMissing && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800 text-sm">
          <AlertTriangle size={16}/>
          <span>CSV caisse non importé pour ce mois — <Link href="/import" className="underline font-medium">Importer maintenant</Link></span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard title="CA Caisse" value={formatMAD(kpis.ca_caisse)} delta={delta_ca}
          icon={<DollarSign size={16} className="text-alaska-sage"/>}/>
        <KPICard title="Dépenses" value={formatMAD(kpis.total_expenses)}
          icon={<ShoppingCart size={16} className="text-orange-500"/>} valueClass="text-orange-600"/>
        <KPICard title="Solde caisse" value={formatMAD(kpis.marge_nette)}
          sub={`${kpis.taux_marge.toFixed(1)}% du CA`}
          icon={<Activity size={16} className={kpis.marge_nette >= 0 ? "text-alaska-sage" : "text-red-500"}/>}
          valueClass={kpis.marge_nette >= 0 ? "text-alaska-gold" : "text-red-600"}/>
        <KPICard title="Seuil"
          value={`${kpis.pct_breakeven.toFixed(0)}%`}
          sub={`${formatMAD(kpis.ca_caisse)} / ${formatMAD(kpis.breakeven)}`}
          icon={<Target size={16} className="text-alaska-sage"/>}
          valueClass={bColor === "green" ? "text-alaska-sage" : bColor === "orange" ? "text-amber-600" : "text-red-600"}
          gauge={kpis.pct_breakeven}/>
      </div>

      {/* AreaChart CA 12 mois */}
      <Card className="bg-white border border-alaska-sage-lt rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-alaska-dark">CA Caisse — 12 derniers mois</CardTitle>
          <CardDescription className="text-xs text-alaska-muted">Ligne tiretée = seuil de rentabilité</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={last12} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradSage" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4a6741" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#4a6741" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11, fill: "#7a7a6a" }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: "#7a7a6a" }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false}/>
              <Tooltip formatter={(v: number) => formatMAD(v)} labelFormatter={monthLabel}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e8ede7", fontSize: "12px" }}/>
              <ReferenceLine y={kpis.breakeven} stroke="#c9a96e" strokeDasharray="4 4"/>
              <Area type="monotone" dataKey="ca_caisse" stroke="#4a6741" strokeWidth={2.5} fill="url(#gradSage)"
                dot={{ r: 3, fill: "#4a6741" }} name="CA Caisse"/>
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top actions */}
      <Card className="bg-white border border-alaska-sage-lt rounded-xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-alaska-dark">Top priorités</CardTitle>
            <Link href="/objectifs" className="text-xs text-alaska-sage hover:underline flex items-center gap-1">
              Toutes <ChevronRight size={12}/>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {topActions.map(action => (
            <div key={action.id} className="flex items-start gap-3 p-3 bg-alaska-sage-lt/50 rounded-lg">
              <span className={cn("mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0",
                LEVER_COLORS[action.lever] || "bg-gray-200 text-gray-700")}>
                {action.lever}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-alaska-dark leading-tight truncate">{action.title}</p>
                <p className="text-xs text-alaska-muted mt-0.5">{action.deadline}</p>
              </div>
              <span className={cn("text-[10px] flex-shrink-0 font-medium",
                action.priority === "urgent" ? "text-red-500" : action.priority === "medium" ? "text-amber-500" : "text-alaska-sage")}>
                {action.priority === "urgent" ? "URGENT" : action.priority === "medium" ? "MOYEN" : "OK"}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Accès rapides */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { href: "/import",    icon: UploadCloud,  label: "Import CSV",  color: "text-alaska-sage" },
          { href: "/saisie",    icon: Edit3,         label: "Saisir",      color: "text-alaska-gold" },
          { href: "/reporting", icon: FileBarChart,  label: "Reporting",   color: "text-alaska-sage" },
        ].map(({ href, icon: Icon, label, color }) => (
          <Link key={href} href={href}>
            <Button variant="outline"
              className="w-full h-14 flex-col gap-1 text-xs border-alaska-sage-lt hover:border-alaska-sage hover:bg-alaska-sage-lt/50 bg-white">
              <Icon size={18} className={color}/>
              <span className="text-alaska-muted">{label}</span>
            </Button>
          </Link>
        ))}
      </div>
    </div>
  )
}

function KPICard({ title, value, sub, delta, icon, valueClass, gauge }: {
  title: string; value: string; sub?: string; delta?: number
  icon: React.ReactNode; valueClass?: string; gauge?: number
}) {
  return (
    <Card className="bg-white border border-alaska-sage-lt rounded-xl">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-medium text-alaska-muted uppercase tracking-wide">{title}</p>
          {icon}
        </div>
        <p className={cn("text-xl font-playfair font-bold", valueClass || "text-alaska-dark")}>{value}</p>
        {gauge !== undefined && (
          <div className="mt-2 w-full bg-alaska-sage-lt rounded-full h-1.5">
            <div className="h-1.5 rounded-full bg-alaska-sage transition-all duration-700"
              style={{ width: `${Math.min(gauge, 100)}%` }}/>
          </div>
        )}
        {delta !== undefined && (
          <p className={cn("text-xs mt-1 flex items-center gap-1", delta >= 0 ? "text-alaska-sage" : "text-red-500")}>
            {delta >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
            {formatPct(delta)} vs mois préc.
          </p>
        )}
        {sub && <p className="text-[11px] text-alaska-muted mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd claude && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add "claude/app/(dashboard)/page.tsx"
git commit -m "feat: dashboard — Alaska palette, AreaChart sage, Playfair KPIs"
```

---

## Task 4: Saisie Visual Polish

**Files:**
- Modify: `claude/app/(dashboard)/saisie/page.tsx`

- [ ] **Step 1: Replace color tokens throughout saisie/page.tsx**

Replace the full file. Logic is unchanged — only visual classes updated:

```tsx
"use client"
import { useState } from "react"
import { format, addDays, subDays, startOfWeek, addWeeks, subWeeks } from "date-fns"
import { fr } from "date-fns/locale"
import { useDailyEntry } from "@/lib/hooks/useDailyEntry"
import { useWeekView } from "@/lib/hooks/useWeekView"
import { useWeekEntries } from "@/lib/hooks/useWeekEntries"
import { FIXED_CHARGES, MONTHLY_CA_2026 } from "@/lib/mock-data"
import { formatMAD } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, CheckCircle2, Minus, Plus, ChevronDown, ChevronUp, Save, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { WeekGrid } from "@/components/saisie/WeekGrid"

const TABS = ["Saisie", "Semaine", "Mois"] as const
type Tab = typeof TABS[number]

const MP_POSTES = ["Poissonnier","Boucher","Poulet","Eau","Technicien"]
const AUTRES_POSTES = ["Loyer","Électricité","Gaz","Internet","Autre"]

export default function SaisiePage() {
  const [tab, setTab] = useState<Tab>("Saisie")
  const [date, setDate] = useState(new Date(2026, 3, 7))
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(2026, 3, 7), { weekStartsOn: 1 }))
  const [viewMonth, setViewMonth] = useState("2026-04")
  const [showAllStaff, setShowAllStaff] = useState(false)

  const dateStr = format(date, "yyyy-MM-dd")
  const { entry, update, updateExpense, addExpense, save, saved } = useDailyEntry(dateStr)
  const weekData = useWeekView(weekStart)
  const { entries: weekEntries, dates: weekDates, updateCA: updateWeekCA, updateExpense: updateWeekExpense } = useWeekEntries(weekStart)

  const staff = FIXED_CHARGES.filter(c => c.is_staff && c.is_active)
  const visibleStaff = showAllStaff ? staff : staff.filter(s => {
    const exp = entry.expenses.find(e => e.label === s.name)
    return exp && exp.amount > 0
  })

  const getOrCreateExpense = (label: string, category: "MP" | "RH" | "CHARGES" | "AUTRE") => {
    return entry.expenses.find(e => e.label === label) || { id: `${label}-${dateStr}`, category, label, amount: 0 }
  }

  const handleExpenseChange = (label: string, category: "MP" | "RH" | "CHARGES" | "AUTRE", amount: number) => {
    const existing = entry.expenses.find(e => e.label === label)
    if (existing) {
      updateExpense(existing.id, Math.max(0, amount))
    } else if (amount > 0) {
      addExpense({ id: `${label}-${dateStr}-${Date.now()}`, category, label, amount })
    }
  }

  const totalExpenses = entry.expenses.reduce((s, e) => s + e.amount, 0)
  const soldeCaisse = entry.ca_caisse - totalExpenses
  const statusIcon = entry.ca_caisse > 0 && totalExpenses > 0 ? "✅"
    : entry.ca_caisse > 0 || totalExpenses > 0 ? "🟡" : "⬜"

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Tabs */}
      <div className="flex bg-white border border-alaska-sage-lt rounded-lg p-1 gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("flex-1 py-2 rounded-md text-sm font-medium transition",
              tab === t ? "bg-alaska-sage text-white" : "text-alaska-muted hover:bg-alaska-sage-lt")}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Saisie" && (
        <div className="space-y-4">
          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <button onClick={() => setDate(d => subDays(d, 1))} className="p-2 hover:bg-alaska-sage-lt rounded-lg transition">
                  <ChevronLeft size={20} className="text-alaska-muted"/>
                </button>
                <div className="text-center">
                  <p className="font-semibold text-alaska-dark capitalize">
                    {format(date, "EEEE d MMMM yyyy", { locale: fr })}
                  </p>
                  <p className="text-lg mt-0.5">{statusIcon}</p>
                </div>
                <button onClick={() => setDate(d => addDays(d, 1))} className="p-2 hover:bg-alaska-sage-lt rounded-lg transition">
                  <ChevronRight size={20} className="text-alaska-muted"/>
                </button>
              </div>
              <button onClick={() => setDate(new Date(2026,3,7))}
                className="w-full mt-2 text-xs text-alaska-sage hover:underline">Aujourd&apos;hui</button>
            </CardContent>
          </Card>

          <Card className="bg-white border-l-4 border-alaska-sage border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-base flex items-center gap-2 text-alaska-dark">
                💰 CA Caisse du jour
                {entry.source === "csv_import" && (
                  <span className="text-xs bg-alaska-sage-lt text-alaska-sage px-2 py-0.5 rounded-full font-normal">Import CSV</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Input type="number" value={entry.ca_caisse || ""}
                  onChange={e => update({ ca_caisse: parseFloat(e.target.value) || 0 })}
                  placeholder="0" className="text-2xl font-playfair font-bold h-14 text-right focus:ring-alaska-sage focus:border-alaska-sage"
                  readOnly={entry.source === "csv_import"}/>
                <span className="text-alaska-muted font-medium">MAD</span>
              </div>
              <div className="flex gap-2">
                {[500,1000,2000,5000].map(v => (
                  <button key={v} onClick={() => update({ ca_caisse: entry.ca_caisse + v })}
                    className="flex-1 py-1.5 text-xs border border-alaska-sage-lt text-alaska-sage rounded-md hover:bg-alaska-sage-lt transition">
                    +{v}
                  </button>
                ))}
              </div>
              <Input placeholder="Notes (Ramadan, groupe, événement...)" value={entry.notes}
                onChange={e => update({ notes: e.target.value })}
                className="text-sm focus:ring-alaska-sage focus:border-alaska-sage"/>
            </CardContent>
          </Card>

          <ExpenseGroup title="🥩 Matières Premières" defaultOpen>
            {MP_POSTES.map(label => {
              const exp = getOrCreateExpense(label, "MP")
              return <ExpenseRow key={label} label={label} value={exp.amount} onChange={v => handleExpenseChange(label, "MP", v)}/>
            })}
          </ExpenseGroup>

          <ExpenseGroup title="👥 Personnel">
            <div className="space-y-2">
              {visibleStaff.map(s => {
                const exp = getOrCreateExpense(s.name, "RH")
                return (
                  <ExpenseRow key={s.id} label={`${s.name}${s.payment_day ? ` (j.${s.payment_day})` : ""}`}
                    value={exp.amount} onChange={v => handleExpenseChange(s.name, "RH", v)}/>
                )
              })}
              <button onClick={() => setShowAllStaff(v => !v)}
                className="w-full text-xs text-alaska-sage hover:underline pt-1">
                {showAllStaff ? "Masquer" : `Afficher tout le personnel (${staff.length})`}
              </button>
            </div>
          </ExpenseGroup>

          <ExpenseGroup title="📦 Autres Charges">
            {AUTRES_POSTES.map(label => {
              const exp = getOrCreateExpense(label, "CHARGES")
              return <ExpenseRow key={label} label={label} value={exp.amount} onChange={v => handleExpenseChange(label, "CHARGES", v)}/>
            })}
          </ExpenseGroup>

          <Card className="bg-alaska-dark text-white rounded-xl">
            <CardContent className="pt-4 pb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-alaska-muted">CA Caisse</span>
                <span className="font-semibold">{formatMAD(entry.ca_caisse)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-alaska-muted">Total sorties</span>
                <span className="font-semibold text-orange-300">-{formatMAD(totalExpenses)}</span>
              </div>
              <div className="border-t border-white/20 pt-2 flex justify-between font-bold text-base">
                <span>💵 Solde caisse</span>
                <span className={cn("font-playfair text-lg", soldeCaisse >= 0 ? "text-alaska-gold" : "text-red-400")}>
                  {soldeCaisse < 0 ? "-" : ""}{formatMAD(Math.abs(soldeCaisse))}
                  {soldeCaisse < 0 && " ⚠"}
                </span>
              </div>
              <Button onClick={save} className="w-full mt-3 bg-white text-alaska-dark hover:bg-alaska-sage-lt font-semibold">
                {saved ? <><CheckCircle2 size={16} className="mr-2"/>Enregistré</> : <><Save size={16} className="mr-2"/>Enregistrer</>}
              </Button>
              {!saved && <p className="text-center text-xs text-alaska-muted flex items-center justify-center gap-1"><Clock size={10}/>Sauvegarde auto dans 2s</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "Semaine" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-alaska-sage-lt rounded-lg p-3">
            <button onClick={() => setWeekStart(w => subWeeks(w, 1))} className="p-1 hover:bg-alaska-sage-lt rounded transition">
              <ChevronLeft size={18} className="text-alaska-muted"/>
            </button>
            <p className="text-sm font-semibold text-alaska-dark">
              {format(weekStart, "d MMM", { locale: fr })} – {format(addDays(weekStart, 6), "d MMM yyyy", { locale: fr })}
            </p>
            <button onClick={() => setWeekStart(w => addWeeks(w, 1))} className="p-1 hover:bg-alaska-sage-lt rounded transition">
              <ChevronRight size={18} className="text-alaska-muted"/>
            </button>
          </div>
          <div className="hidden md:block bg-white border border-alaska-sage-lt rounded-xl p-4">
            <WeekGrid entries={weekEntries} dates={weekDates} onUpdateCA={updateWeekCA} onUpdateExpense={updateWeekExpense}/>
          </div>
          <div className="md:hidden space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-white border border-alaska-sage-lt rounded-xl">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-alaska-muted">CA semaine</p>
                  <p className="text-xl font-playfair font-bold text-alaska-dark">{formatMAD(weekData.totalCA)}</p>
                  <p className="text-xs text-alaska-muted">{weekData.pctBreakeven.toFixed(0)}% du seuil</p>
                </CardContent>
              </Card>
              <Card className="bg-white border border-alaska-sage-lt rounded-xl">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-alaska-muted">Dépenses</p>
                  <p className="text-xl font-playfair font-bold text-orange-600">{formatMAD(weekData.totalDep)}</p>
                  <p className="text-xs text-alaska-muted">Solde : {formatMAD(weekData.totalCA - weekData.totalDep)}</p>
                </CardContent>
              </Card>
            </div>
            <Card className="bg-white border border-alaska-sage-lt rounded-xl">
              <CardContent className="pt-4 pb-2 space-y-2">
                {weekData.days.map(day => (
                  <button key={day.date} onClick={() => { setDate(new Date(day.date)); setTab("Saisie") }}
                    className="w-full flex items-center justify-between p-3 bg-alaska-sage-lt/40 hover:bg-alaska-sage-lt rounded-lg transition text-left">
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{day.status === "full" ? "✅" : day.status === "partial" ? "🟡" : "⬜"}</span>
                      <span className="text-sm font-medium capitalize text-alaska-dark">{day.label}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-alaska-dark">{day.entry ? formatMAD(day.entry.ca_caisse) : "—"}</p>
                      {day.totalExpenses > 0 && <p className="text-xs text-alaska-muted">Dép: {formatMAD(day.totalExpenses)}</p>}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "Mois" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-alaska-sage-lt rounded-lg p-3">
            <button onClick={() => {
              const [y,m] = viewMonth.split("-").map(Number)
              setViewMonth(m===1?`${y-1}-12`:`${y}-${String(m-1).padStart(2,"0")}`)
            }} className="p-1 hover:bg-alaska-sage-lt rounded"><ChevronLeft size={18} className="text-alaska-muted"/></button>
            <p className="text-sm font-semibold text-alaska-dark">{viewMonth}</p>
            <button onClick={() => {
              const [y,m] = viewMonth.split("-").map(Number)
              setViewMonth(m===12?`${y+1}-01`:`${y}-${String(m+1).padStart(2,"0")}`)
            }} className="p-1 hover:bg-alaska-sage-lt rounded"><ChevronRight size={18} className="text-alaska-muted"/></button>
          </div>
          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-alaska-muted">CA Caisse (importé)</span>
                <span className="font-playfair font-bold text-alaska-dark">{formatMAD(MONTHLY_CA_2026[viewMonth]?.ca_caisse || 0)}</span>
              </div>
              <p className="text-xs text-alaska-muted text-center pt-2">Vue simplifiée — dépenses détaillées dans onglet Saisie</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function ExpenseGroup({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="bg-white border border-alaska-sage-lt rounded-xl">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between p-4 text-left">
        <span className="font-semibold text-alaska-dark text-sm">{title}</span>
        {open ? <ChevronUp size={18} className="text-alaska-muted"/> : <ChevronDown size={18} className="text-alaska-muted"/>}
      </button>
      {open && <CardContent className="pt-0 pb-4 space-y-2">{children}</CardContent>}
    </Card>
  )
}

function ExpenseRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-alaska-dark flex-1 min-w-0 truncate">{label}</span>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onChange(Math.max(0, value - 100))}
          className="w-7 h-7 flex items-center justify-center border border-alaska-sage-lt rounded-md hover:bg-alaska-sage-lt">
          <Minus size={12} className="text-alaska-muted"/>
        </button>
        <input type="number" value={value || ""} placeholder="0"
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-24 h-8 text-right text-sm border border-alaska-sage-lt rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-alaska-sage focus:border-alaska-sage"/>
        <button onClick={() => onChange(value + 100)}
          className="w-7 h-7 flex items-center justify-center border border-alaska-sage-lt rounded-md hover:bg-alaska-sage-lt">
          <Plus size={12} className="text-alaska-muted"/>
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd claude && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add "claude/app/(dashboard)/saisie/page.tsx"
git commit -m "feat: saisie visual polish — Alaska palette, Playfair solde caisse"
```

---

## Task 5: Charges Visual Polish

**Files:**
- Modify: `claude/app/(dashboard)/charges/page.tsx`

- [ ] **Step 1: Rewrite charges/page.tsx**

```tsx
"use client"
import { useState } from "react"
import { useCharges } from "@/lib/hooks/useCharges"
import { formatMAD } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Edit2, UserX, Zap } from "lucide-react"

const CAT_LABELS: Record<string, string> = {
  IMMOBILIER: "🏠 Immobilier", PERSONNEL: "👥 Personnel",
  ENERGIE: "⚡ Énergie", TELECOM: "📡 Télécom", DIVERS: "📦 Divers",
}

export default function ChargesPage() {
  const { byCategory, totalActive, breakeven, simExtra, setSimExtra, simulatedBreakeven, updateCharge, deactivateCharge } = useCharges()
  const [editId, setEditId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState("")
  const [showSim, setShowSim] = useState(false)
  const [simSalaire, setSimSalaire] = useState(5000)

  const handleSave = (id: string) => {
    updateCharge(id, parseFloat(editVal) || 0)
    setEditId(null)
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Charges fixes</h1>
        <p className="text-alaska-muted text-sm mt-1">Gestion et simulation d&apos;impact</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-white border border-alaska-sage-lt rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-[11px] text-alaska-muted uppercase tracking-wide">Total mensuel</p>
            <p className="text-2xl font-playfair font-bold text-orange-600">{formatMAD(totalActive)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border border-alaska-sage-lt rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-[11px] text-alaska-muted uppercase tracking-wide">Seuil rentabilité</p>
            <p className="text-2xl font-playfair font-bold text-alaska-dark">{formatMAD(breakeven)}</p>
          </CardContent>
        </Card>
      </div>

      <Button onClick={() => setShowSim(v => !v)} variant="outline"
        className="w-full gap-2 border-alaska-sage-lt text-alaska-dark hover:bg-alaska-sage-lt">
        <Zap size={16} className="text-alaska-sage"/>
        {showSim ? "Fermer le simulateur" : "Simuler un changement"}
      </Button>

      {showSim && (
        <Card className="bg-alaska-sage-lt border border-alaska-sage/30 rounded-xl">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-base text-alaska-dark">🔮 Simulateur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-alaska-dark mb-2">Ajouter un employé fictif :</p>
              <div className="flex gap-2">
                <Input type="number" value={simSalaire}
                  onChange={e => { setSimSalaire(+e.target.value); setSimExtra(+e.target.value) }}
                  className="flex-1 focus:ring-alaska-sage focus:border-alaska-sage"/>
                <span className="flex items-center text-sm text-alaska-muted">MAD/mois</span>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 space-y-2 border border-alaska-sage-lt">
              <div className="flex justify-between text-sm">
                <span className="text-alaska-muted">Charges actuelles</span>
                <span className="font-medium text-alaska-dark">{formatMAD(totalActive)}</span>
              </div>
              <div className="flex justify-between text-sm text-alaska-sage">
                <span>+ Simulation</span>
                <span className="font-medium">+{formatMAD(simExtra)}</span>
              </div>
              <div className="border-t border-alaska-sage-lt pt-2 flex justify-between font-bold">
                <span className="text-alaska-dark">Nouveau seuil</span>
                <span className="text-orange-600">{formatMAD(simulatedBreakeven)}</span>
              </div>
              <div className="flex justify-between text-xs text-alaska-muted">
                <span>Delta seuil</span><span>+{formatMAD(simulatedBreakeven - breakeven)}</span>
              </div>
            </div>
            <Button variant="outline" className="w-full text-xs border-alaska-sage-lt hover:bg-white"
              onClick={() => { setSimExtra(0); setSimSalaire(5000) }}>
              Réinitialiser
            </Button>
          </CardContent>
        </Card>
      )}

      {Object.entries(CAT_LABELS).map(([cat, label]) => {
        const items = byCategory[cat as keyof typeof byCategory] || []
        if (items.length === 0) return null
        const catTotal = items.reduce((s, c) => s + c.amount, 0)
        const maxAmt = Math.max(...items.map(c => c.amount), 1)
        return (
          <Card key={cat} className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-alaska-dark">{label}</CardTitle>
                <span className="text-sm font-playfair font-bold text-alaska-sage">{formatMAD(catTotal)}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {items.map(c => (
                <div key={c.id} className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-alaska-dark">{c.name}</p>
                      {c.payment_day && <p className="text-xs text-alaska-muted">{c.payment_day === 1 ? "1er" : `${c.payment_day}`} du mois</p>}
                    </div>
                    {editId === c.id ? (
                      <div className="flex gap-2">
                        <Input type="number" value={editVal} onChange={e => setEditVal(e.target.value)}
                          className="w-24 h-8 text-right text-sm focus:ring-alaska-sage focus:border-alaska-sage"/>
                        <Button size="sm" className="h-8 text-xs bg-alaska-sage hover:bg-alaska-sage/90" onClick={() => handleSave(c.id)}>OK</Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditId(null)}>✕</Button>
                      </div>
                    ) : (
                      <>
                        <span className="font-semibold text-sm text-alaska-dark">{formatMAD(c.amount)}</span>
                        <button onClick={() => { setEditId(c.id); setEditVal(String(c.amount)) }}
                          className="p-1.5 hover:bg-alaska-sage-lt rounded-md">
                          <Edit2 size={14} className="text-alaska-muted"/>
                        </button>
                        {c.is_staff && (
                          <button onClick={() => deactivateCharge(c.id)} className="p-1.5 hover:bg-red-50 text-red-400 rounded-md">
                            <UserX size={14}/>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="w-full bg-alaska-sage-lt rounded-full h-1">
                    <div className="h-1 rounded-full bg-alaska-sage transition-all duration-500"
                      style={{ width: `${(c.amount / maxAmt) * 100}%` }}/>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd claude && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add "claude/app/(dashboard)/charges/page.tsx"
git commit -m "feat: charges visual polish — Alaska palette + proportional bars"
```

---

## Task 6: Objectifs Visual Polish

**Files:**
- Modify: `claude/app/(dashboard)/objectifs/page.tsx`

- [ ] **Step 1: Rewrite objectifs/page.tsx**

```tsx
"use client"
import { useState } from "react"
import { useObjectives } from "@/lib/hooks/useObjectives"
import { MONTHLY_CA_2026 } from "@/lib/mock-data"
import { formatMAD } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ActionItem } from "@/lib/types"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { cn } from "@/lib/utils"

const TABS = ["Objectifs", "Plan d'action", "Trajectoire"] as const
const LEVER_LABELS: Record<string, string> = {
  soir: "🌙 Soir", terrasse: "☀️ Terrasse", b2b: "💼 B2B",
  marketing: "📱 Marketing", pilotage: "⚙️ Pilotage",
}
const LEVER_COLORS: Record<string, string> = {
  soir: "bg-alaska-sage text-white",
  terrasse: "bg-alaska-gold text-white",
  b2b: "bg-amber-500 text-white",
  marketing: "bg-blue-500 text-white",
  pilotage: "bg-purple-500 text-white",
}
const MONTHS_FR = ["Jan","Fév","Mars","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]

export default function ObjectifsPage() {
  const [tab, setTab] = useState<"Objectifs" | "Plan d'action" | "Trajectoire">("Objectifs")
  const { actions, updateActionStatus, cumulativeReal, yearlyTarget, pctAnnuel, byLever, monthlyObjectives } = useObjectives()
  const [filterLever, setFilterLever] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  const monthlyData = monthlyObjectives.map((mo, i) => {
    const key = `2026-${String(mo.month).padStart(2,"0")}`
    const real = (MONTHLY_CA_2026[key]?.ca_caisse || 0) + (MONTHLY_CA_2026[key]?.ca_b2b || 0)
    return { month: MONTHS_FR[i], target: mo.target_ca, real: real || null }
  })

  const filteredActions = actions.filter(a =>
    (filterLever === "all" || a.lever === filterLever) &&
    (filterStatus === "all" || a.status === filterStatus)
  )

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Objectifs & Plan d&apos;action</h1>
        <p className="text-alaska-muted text-sm mt-1">Pilotage stratégique Alaska Neo Bistrot 2026</p>
      </div>

      <div className="flex bg-white border border-alaska-sage-lt rounded-lg p-1 gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t as any)}
            className={cn("flex-1 py-2 rounded-md text-xs font-medium transition",
              tab === t ? "bg-alaska-sage text-white" : "text-alaska-muted hover:bg-alaska-sage-lt")}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Objectifs" && (
        <div className="space-y-4">
          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardContent className="pt-5 pb-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-alaska-dark">Progression 2026</p>
                  <p className="text-xs text-alaska-muted mt-0.5">Objectif réaliste : {formatMAD(yearlyTarget)}</p>
                </div>
                <span className={cn("text-sm font-bold px-2 py-0.5 rounded-full",
                  pctAnnuel >= 100 ? "bg-alaska-sage text-white" : "bg-alaska-sage-lt text-alaska-sage")}>
                  {pctAnnuel.toFixed(0)}%
                </span>
              </div>
              <p className="font-playfair text-3xl font-bold text-alaska-dark mb-3">{formatMAD(cumulativeReal)}</p>
              <div className="w-full bg-alaska-sage-lt rounded-full h-2.5">
                <div className="h-2.5 rounded-full bg-alaska-sage transition-all duration-700"
                  style={{ width: `${Math.min(pctAnnuel,100)}%` }}/>
              </div>
              <div className="flex justify-between text-xs text-alaska-muted mt-1.5">
                <span>Réel</span>
                <span>Cible : {formatMAD(yearlyTarget)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-alaska-dark">CA mensuel vs Objectif 2026</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#7a7a6a" }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 11, fill: "#7a7a6a" }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={(v: number) => formatMAD(v)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e8ede7", fontSize: "12px" }}/>
                  <Bar dataKey="real" fill="#4a6741" name="CA réel" radius={[4,4,0,0]}/>
                  <Bar dataKey="target" fill="#e8ede7" name="Objectif" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-alaska-dark">Décomposition mensuelle</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-2">
                {monthlyObjectives.slice(0,4).map((mo, i) => {
                  const key = `2026-${String(mo.month).padStart(2,"0")}`
                  const real = MONTHLY_CA_2026[key]?.ca_caisse || 0
                  const pct = mo.target_ca > 0 ? (real / mo.target_ca) * 100 : 0
                  const done = real > 0
                  return (
                    <div key={i} className="flex items-center gap-3 p-2 hover:bg-alaska-sage-lt/40 rounded-lg">
                      <span className="text-sm w-10 text-alaska-muted">{MONTHS_FR[i]}</span>
                      <div className="flex-1 bg-alaska-sage-lt rounded-full h-2">
                        <div className={cn("h-2 rounded-full", pct >= 100 ? "bg-alaska-sage" : pct >= 70 ? "bg-amber-400" : "bg-red-400")}
                          style={{ width: `${Math.min(pct,100)}%` }}/>
                      </div>
                      <span className="text-xs w-20 text-right font-medium text-alaska-dark">{done ? formatMAD(real) : "—"}</span>
                      <span className="text-xs w-16 text-right text-alaska-muted">{formatMAD(mo.target_ca)}</span>
                      <span className={cn("text-xs w-12 text-right font-medium",
                        pct >= 100 ? "text-alaska-sage" : pct > 0 ? "text-amber-500" : "text-alaska-muted")}>
                        {done ? `${pct >= 100 ? "✅" : "❌"} ${pct.toFixed(0)}%` : "⏳"}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "Plan d'action" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {byLever.map(({ lever, total, done, pct }) => (
              <button key={lever} onClick={() => setFilterLever(f => f === lever ? "all" : lever)}
                className={cn("p-3 rounded-xl border text-left transition bg-white",
                  filterLever === lever ? "border-alaska-sage bg-alaska-sage-lt" : "border-alaska-sage-lt hover:bg-alaska-sage-lt/50")}>
                <p className="text-xs font-medium text-alaska-dark">{LEVER_LABELS[lever]}</p>
                <div className="mt-1.5 bg-alaska-sage-lt rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-alaska-sage" style={{ width: `${pct}%` }}/>
                </div>
                <p className="text-xs text-alaska-muted mt-1">{done}/{total} faites</p>
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            {[["all","Toutes"],["todo","À faire"],["in_progress","En cours"],["done","Faites"]].map(([v,l]) => (
              <button key={v} onClick={() => setFilterStatus(v)}
                className={cn("px-3 py-1 rounded-full text-xs border transition",
                  filterStatus === v ? "bg-alaska-sage text-white border-alaska-sage" : "bg-white text-alaska-muted border-alaska-sage-lt hover:bg-alaska-sage-lt")}>
                {l}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredActions.map(action => (
              <ActionCard key={action.id} action={action} onStatusChange={updateActionStatus} leverColors={LEVER_COLORS}/>
            ))}
          </div>
        </div>
      )}

      {tab === "Trajectoire" && (
        <div className="space-y-4">
          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-alaska-dark">Trajectoire 3 ans</CardTitle>
              <CardDescription className="text-xs text-alaska-muted">CA Total (Caisse + B2B)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={[
                  { year: "2025", reel: 1752217 },
                  { year: "2026", prudent: 1927439, realiste: 2277882, ambitieux: 2628326, reel: cumulativeReal },
                  { year: "2027", prudent: 2120183, realiste: 2847352, ambitieux: 3942489 },
                ]}>
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#7a7a6a" }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 11, fill: "#7a7a6a" }} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={(v: number) => formatMAD(v)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e8ede7", fontSize: "12px" }}/>
                  <Line type="monotone" dataKey="reel" stroke="#4a6741" strokeWidth={3} name="Réel" dot={{ r: 5, fill: "#4a6741" }}/>
                  <Line type="monotone" dataKey="realiste" stroke="#c9a96e" strokeWidth={2} strokeDasharray="5 5" name="Réaliste"/>
                  <Line type="monotone" dataKey="prudent" stroke="#7a7a6a" strokeWidth={1.5} strokeDasharray="3 3" name="Prudent"/>
                  <Line type="monotone" dataKey="ambitieux" stroke="#16a34a" strokeWidth={1.5} strokeDasharray="5 5" name="Ambitieux"/>
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardContent className="pt-4 pb-4">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-alaska-muted border-b border-alaska-sage-lt">
                  <th className="text-left pb-2">Année</th>
                  <th className="text-right pb-2">Prudent</th>
                  <th className="text-right pb-2">Réaliste</th>
                  <th className="text-right pb-2">Ambitieux</th>
                </tr></thead>
                <tbody className="divide-y divide-alaska-sage-lt">
                  <tr><td className="py-2 font-medium text-alaska-dark">2025 ✅</td><td/><td className="text-right text-alaska-sage font-bold font-playfair">1 752 217</td><td/></tr>
                  <tr className="bg-alaska-sage-lt/30"><td className="py-2 font-medium text-alaska-dark">2026 🔄</td>
                    <td className="text-right text-alaska-muted">1 927k</td>
                    <td className="text-right font-bold text-alaska-dark font-playfair">2 278k</td>
                    <td className="text-right text-green-600">2 628k</td>
                  </tr>
                  <tr><td className="py-2 font-medium text-alaska-dark">2027</td>
                    <td className="text-right text-alaska-muted">2 120k</td>
                    <td className="text-right text-alaska-muted">2 847k</td>
                    <td className="text-right text-green-500">3 942k</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function ActionCard({ action, onStatusChange, leverColors }: {
  action: ActionItem
  onStatusChange: (id: string, s: ActionItem["status"]) => void
  leverColors: Record<string, string>
}) {
  const next: Record<ActionItem["status"], ActionItem["status"]> = {
    todo: "in_progress", in_progress: "done", done: "todo", cancelled: "todo"
  }
  return (
    <Card className={cn("bg-white border-l-4 border border-alaska-sage-lt rounded-xl",
      action.priority === "urgent" ? "border-l-red-500" : action.priority === "medium" ? "border-l-amber-400" : "border-l-alaska-sage")}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full", leverColors[action.lever] || "bg-gray-200 text-gray-700")}>
                {action.lever.toUpperCase()}
              </span>
              <span className="text-xs text-alaska-muted">{action.deadline}</span>
            </div>
            <p className="font-medium text-sm text-alaska-dark">{action.title}</p>
            {action.description && <p className="text-xs text-alaska-muted mt-1 leading-relaxed">{action.description}</p>}
          </div>
          <button onClick={() => onStatusChange(action.id, next[action.status])}
            className={cn("flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition",
              action.status === "done" ? "bg-alaska-sage-lt text-alaska-sage border-alaska-sage"
              : action.status === "in_progress" ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-white text-alaska-muted border-alaska-sage-lt hover:bg-alaska-sage-lt")}>
            {action.status === "done" ? "✅ Fait" : action.status === "in_progress" ? "🔄 En cours" : "○ À faire"}
          </button>
        </div>
        {action.budget_max > 0 && (
          <p className="text-xs text-alaska-muted mt-2">
            Budget : {formatMAD(action.budget_min)}{action.budget_max !== action.budget_min ? ` – ${formatMAD(action.budget_max)}` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd claude && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add "claude/app/(dashboard)/objectifs/page.tsx"
git commit -m "feat: objectifs visual polish — Alaska palette, lever badge colors"
```

---

## Task 7: Import Visual Polish

**Files:**
- Modify: `claude/app/(dashboard)/import/page.tsx`

- [ ] **Step 1: Rewrite import/page.tsx**

```tsx
"use client"
import { useState, useRef } from "react"
import { IMPORT_HISTORY } from "@/lib/mock-data"
import { formatMAD } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { UploadCloud, CheckCircle2, AlertCircle, FileText, X } from "lucide-react"
import { parseCSV } from "@/lib/csv-parser"
import { saveLocalEntry } from "@/lib/local-store"
import { cn } from "@/lib/utils"

type Step = "upload" | "preview" | "done"

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload")
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [result, setResult] = useState<{ days: number; rows: number; ca: number } | null>(null)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (f: File) => {
    if (!f.name.endsWith(".csv")) { setError("Format non supporté. Veuillez importer un fichier .csv"); return }
    setFile(f); setError("")
    const text = await f.text()
    try {
      const parsed = parseCSV(text)
      if (parsed.length === 0) { setError("Le fichier est vide ou le format n'est pas reconnu."); return }
      setPreview(parsed); setStep("preview")
    } catch {
      setError("Format CSV non reconnu. Vérifiez que c'est bien un export de votre logiciel de caisse.")
    }
  }

  const handleConfirm = () => {
    preview.forEach(row => saveLocalEntry({
      date: row.date, ca_caisse: row.ca_caisse, ca_b2b: 0,
      ca_soir: row.ca_soir, pct_soir: row.pct_soir,
      tickets_count: row.tickets_count, notes: "", source: "csv_import", expenses: [],
    }))
    setResult({ days: preview.length, rows: preview.reduce((s,r) => s + r.tickets_count, 0), ca: preview.reduce((s,r) => s + r.ca_caisse, 0) })
    setStep("done")
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Import CSV Caisse</h1>
        <p className="text-alaska-muted text-sm mt-1">Importer le rapport mensuel de votre logiciel de caisse</p>
      </div>

      {step === "upload" && (
        <div className="space-y-4">
          <Card
            className={cn("border-2 border-dashed cursor-pointer rounded-xl transition",
              dragging ? "border-alaska-sage bg-alaska-sage-lt" : "border-alaska-sage-lt hover:border-alaska-sage hover:bg-alaska-sage-lt/40")}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if(f) handleFile(f) }}
            onClick={() => inputRef.current?.click()}>
            <CardContent className="pt-10 pb-10 flex flex-col items-center gap-4">
              <UploadCloud size={40} className={dragging ? "text-alaska-sage" : "text-alaska-muted"}/>
              <div className="text-center">
                <p className="font-semibold text-alaska-dark">Glisser-déposer le CSV ici</p>
                <p className="text-sm text-alaska-muted">ou cliquer pour sélectionner</p>
              </div>
              <p className="text-xs text-alaska-muted">Format : .csv · Taille max : 10 MB</p>
              <input ref={inputRef} type="file" accept=".csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if(f) handleFile(f) }}/>
            </CardContent>
          </Card>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
              <AlertCircle size={16}/> {error}
            </div>
          )}

          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-alaska-dark">Derniers imports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {IMPORT_HISTORY.map(imp => (
                <div key={imp.id} className="flex items-center gap-3 p-2 bg-alaska-sage-lt/30 rounded-lg">
                  <CheckCircle2 size={16} className="text-alaska-sage flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-alaska-dark truncate">{imp.filename}</p>
                    <p className="text-xs text-alaska-muted">{imp.days_imported} jours · {formatMAD(imp.ca_total)}</p>
                  </div>
                  <span className="text-xs text-alaska-muted">{imp.imported_at.slice(0,10)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <Card className="bg-alaska-sage-lt border border-alaska-sage/30 rounded-xl">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <FileText size={20} className="text-alaska-sage"/>
              <div>
                <p className="font-semibold text-sm text-alaska-dark">{file?.name}</p>
                <p className="text-xs text-alaska-sage">{preview.length} jours · {preview.reduce((s,r)=>s+r.tickets_count,0)} tickets</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-alaska-dark">Aperçu — {preview.length} jours</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-alaska-muted border-b border-alaska-sage-lt">
                    <th className="text-left pb-2">Date</th>
                    <th className="text-right pb-2">CA</th>
                    <th className="text-right pb-2">Soir %</th>
                    <th className="text-right pb-2">Tickets</th>
                  </tr></thead>
                  <tbody className="divide-y divide-alaska-sage-lt">
                    {preview.slice(0,10).map((row,i) => (
                      <tr key={i} className="hover:bg-alaska-sage-lt/30">
                        <td className="py-1.5 text-alaska-dark">{row.date}</td>
                        <td className="text-right font-playfair font-medium text-alaska-dark">{formatMAD(row.ca_caisse)}</td>
                        <td className="text-right text-alaska-muted">{row.pct_soir.toFixed(0)}%</td>
                        <td className="text-right text-alaska-muted">{row.tickets_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 10 && <p className="text-xs text-alaska-muted text-center pt-2">+ {preview.length - 10} jours supplémentaires</p>}
              </div>
            </CardContent>
          </Card>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 gap-2 border-alaska-sage-lt hover:bg-alaska-sage-lt" onClick={() => setStep("upload")}>
              <X size={16}/> Annuler
            </Button>
            <Button className="flex-1 gap-2 bg-alaska-sage hover:bg-alaska-sage/90 text-white" onClick={handleConfirm}>
              <CheckCircle2 size={16}/> Confirmer l&apos;import
            </Button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <Card className="bg-alaska-sage-lt border border-alaska-sage/30 rounded-xl">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle2 size={48} className="text-alaska-sage mx-auto"/>
            <div>
              <h2 className="font-playfair text-xl font-bold text-alaska-dark">Import terminé !</h2>
              <div className="mt-4 space-y-1 text-sm text-alaska-dark">
                <p>✅ {result.days} jours importés</p>
                <p>✅ {result.rows} tickets traités</p>
                <p>✅ CA total : {formatMAD(result.ca)}</p>
              </div>
            </div>
            <Button className="bg-alaska-sage hover:bg-alaska-sage/90 text-white" onClick={() => setStep("upload")}>
              Nouvel import
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd claude && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add "claude/app/(dashboard)/import/page.tsx"
git commit -m "feat: import visual polish — Alaska palette, sage drag-drop zone"
```

---

## Task 8: ExpenseBar Shared Component

**Files:**
- Create: `claude/components/ExpenseBar.tsx`

- [ ] **Step 1: Create ExpenseBar.tsx**

```tsx
interface ExpenseBarItem {
  label: string
  amount: number
}

interface ExpenseBarProps {
  items: ExpenseBarItem[]
  maxItems?: number
}

export function ExpenseBar({ items, maxItems = 10 }: ExpenseBarProps) {
  const visible = items.slice(0, maxItems)
  const maxAmount = Math.max(...visible.map(i => i.amount), 1)

  if (visible.length === 0) {
    return <p className="text-sm text-alaska-muted text-center py-4">Aucune dépense pour cette période</p>
  }

  return (
    <div className="space-y-3">
      {visible.map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-sm text-alaska-dark w-32 truncate flex-shrink-0">{item.label}</span>
          <div className="flex-1 bg-alaska-sage-lt rounded-full h-2">
            <div
              className="h-2 rounded-full bg-alaska-sage transition-all duration-500"
              style={{ width: `${(item.amount / maxAmount) * 100}%` }}
            />
          </div>
          <span className="text-sm font-playfair font-semibold text-alaska-dark w-24 text-right flex-shrink-0">
            {item.amount.toLocaleString("fr-MA")} MAD
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd claude && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add claude/components/ExpenseBar.tsx
git commit -m "feat: ExpenseBar — reusable horizontal bars for Reporting + Semaine"
```

---

## Task 9: Reporting Page — Full Rebuild

**Files:**
- Modify: `claude/app/(dashboard)/reporting/page.tsx`

- [ ] **Step 1: Rewrite reporting/page.tsx with 4 sections**

```tsx
"use client"
import { useState, useMemo } from "react"
import { MONTHLY_OBJECTIVES_2026, getMockMonthlyCA } from "@/lib/mock-data"
import { getLocalEntries } from "@/lib/local-store"
import { formatMAD } from "@/lib/utils"
import { calcBreakevenPct, BREAKEVEN } from "@/lib/calculations"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, ChevronLeft, ChevronRight } from "lucide-react"
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { ExpenseBar } from "@/components/ExpenseBar"
import { cn } from "@/lib/utils"

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]
const MONTHS_SHORT = ["Jan","Fév","Mars","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]
const PIE_COLORS = ["#4a6741", "#c9a96e", "#e6a830", "#7a7a6a"]
const PIE_CATS = ["MP", "RH", "CHARGES", "AUTRE"] as const

function prevMonthStr(month: string): string {
  const [y, m] = month.split("-").map(Number)
  return m === 1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,"0")}`
}

export default function ReportingPage() {
  const [month, setMonth] = useState("2026-04")
  const [y, m] = month.split("-").map(Number)

  const prevM = () => setMonth(prevMonthStr(month))
  const nextM = () => {
    const [yr, mo] = month.split("-").map(Number)
    setMonth(mo === 12 ? `${yr+1}-01` : `${yr}-${String(mo+1).padStart(2,"0")}`)
  }

  const { monthCA, prevCA, monthExp, expByLabel, byCategory, pctSeuil, soldeMois } = useMemo(() => {
    const entries = Object.values(getLocalEntries()).filter(e => e.date.startsWith(month))
    const monthCA = getMockMonthlyCA(month).ca_caisse
    const prevCA = getMockMonthlyCA(prevMonthStr(month)).ca_caisse
    const allExp = entries.flatMap(e => e.expenses)
    const monthExp = allExp.reduce((s, e) => s + e.amount, 0)

    const labelMap: Record<string, number> = {}
    allExp.forEach(e => { labelMap[e.label] = (labelMap[e.label] || 0) + e.amount })
    const expByLabel = Object.entries(labelMap).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount)

    const catMap: Record<string, number> = { MP: 0, RH: 0, CHARGES: 0, AUTRE: 0 }
    allExp.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount })
    const byCategory = PIE_CATS.map(cat => ({ name: cat, value: catMap[cat] }))

    const pctSeuil = calcBreakevenPct(monthCA, BREAKEVEN)
    const soldeMois = monthCA - monthExp
    return { monthCA, prevCA, monthExp, expByLabel, byCategory, pctSeuil, soldeMois }
  }, [month])

  const pctVsPrev = prevCA > 0 ? ((monthCA - prevCA) / prevCA) * 100 : 0

  const last6 = useMemo(() => {
    const result = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1)
      const mo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}`
      const idx = d.getMonth()
      const ca = getMockMonthlyCA(mo).ca_caisse
      const objectif = MONTHLY_OBJECTIVES_2026.find(o => o.month === idx + 1)?.target_ca ?? null
      result.push({ month: MONTHS_SHORT[idx], ca, objectif })
    }
    return result
  }, [month])

  const exportCSV = () => {
    const rows = Object.values(getLocalEntries())
      .filter(e => e.date.startsWith(month))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(e => {
        const total = e.expenses.reduce((s, x) => s + x.amount, 0)
        const c = { MP: 0, RH: 0, CHARGES: 0, AUTRE: 0 }
        e.expenses.forEach(x => { c[x.category as keyof typeof c] += x.amount })
        return `${e.date},${e.ca_caisse},${total},${c.MP},${c.RH},${c.CHARGES},${c.AUTRE}`
      })
    const csv = ["Date,CA Caisse,Total Dépenses,MP,RH,CHARGES,AUTRE", ...rows].join("\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    a.download = `alaska_${month}.csv`
    a.click()
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Reporting</h1>
          <p className="text-alaska-muted text-sm mt-1">Analyse mensuelle</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-alaska-sage-lt rounded-lg p-1">
          <button onClick={prevM} className="p-1.5 hover:bg-alaska-sage-lt rounded-md transition"><ChevronLeft size={16}/></button>
          <span className="text-sm font-semibold px-2 min-w-[140px] text-center text-alaska-dark">
            {MONTHS_FR[m-1]} {y}
          </span>
          <button onClick={nextM} className="p-1.5 hover:bg-alaska-sage-lt rounded-md transition"><ChevronRight size={16}/></button>
        </div>
      </div>

      {/* Section 1 — KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <RKPICard title="CA Caisse" value={formatMAD(monthCA)}
          sub={`${pctVsPrev >= 0 ? "+" : ""}${pctVsPrev.toFixed(0)}% vs préc.`}
          subColor={pctVsPrev >= 0 ? "text-alaska-sage" : "text-red-500"}/>
        <RKPICard title="Dépenses" value={formatMAD(monthExp)} valueClass="text-orange-600"/>
        <RKPICard title="Solde" value={formatMAD(soldeMois)}
          valueClass={soldeMois >= 0 ? "text-alaska-gold" : "text-red-600"}/>
        <RKPICard title="% Seuil" value={`${pctSeuil.toFixed(0)}%`} gauge={pctSeuil}
          valueClass={pctSeuil >= 100 ? "text-alaska-sage" : pctSeuil >= 70 ? "text-amber-600" : "text-red-600"}/>
      </div>

      {/* Section 2 — Dépenses par poste */}
      <Card className="bg-white border border-alaska-sage-lt rounded-xl">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base text-alaska-dark">Dépenses par poste</CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <ExpenseBar items={expByLabel} maxItems={8}/>
        </CardContent>
      </Card>

      {/* Section 3 — Évolution CA 6 mois */}
      <Card className="bg-white border border-alaska-sage-lt rounded-xl">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base text-alaska-dark">Évolution CA — 6 mois</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={last6} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCA6" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4a6741" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#4a6741" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#7a7a6a" }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: "#7a7a6a" }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false}/>
              <Tooltip formatter={(v: number) => formatMAD(v)}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e8ede7", fontSize: "12px" }}/>
              <Area type="monotone" dataKey="ca" stroke="#4a6741" strokeWidth={2.5} fill="url(#gradCA6)"
                name="CA réel" dot={{ r: 3, fill: "#4a6741" }}/>
              <Area type="monotone" dataKey="objectif" stroke="#c9a96e" strokeWidth={1.5}
                strokeDasharray="5 5" fill="none" name="Objectif" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Section 4 — Répartition dépenses */}
      <Card className="bg-white border border-alaska-sage-lt rounded-xl">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base text-alaska-dark">Répartition des dépenses</CardTitle>
        </CardHeader>
        <CardContent>
          {byCategory.some(c => c.value > 0) ? (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={byCategory} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]}/>)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatMAD(v)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e8ede7", fontSize: "12px" }}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {byCategory.map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i] }}/>
                    <span className="text-sm text-alaska-dark flex-1">{cat.name}</span>
                    <span className="text-sm font-playfair font-semibold text-alaska-dark">{formatMAD(cat.value)}</span>
                    <span className="text-xs text-alaska-muted w-10 text-right">
                      {monthExp > 0 ? `${((cat.value / monthExp) * 100).toFixed(0)}%` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-alaska-muted text-center py-8">Aucune dépense saisie pour ce mois</p>
          )}
        </CardContent>
      </Card>

      {/* Export */}
      <Button variant="outline"
        className="w-full justify-start gap-3 h-12 border-alaska-sage-lt hover:bg-alaska-sage-lt bg-white"
        onClick={exportCSV}>
        <Download size={18} className="text-alaska-sage"/>
        <div className="text-left">
          <p className="text-sm font-medium text-alaska-dark">Exporter CSV</p>
          <p className="text-xs text-alaska-muted">CA + dépenses par poste — {MONTHS_FR[m-1]} {y}</p>
        </div>
      </Button>
    </div>
  )
}

function RKPICard({ title, value, sub, subColor, valueClass, gauge }: {
  title: string; value: string; sub?: string; subColor?: string; valueClass?: string; gauge?: number
}) {
  return (
    <Card className="bg-white border border-alaska-sage-lt rounded-xl">
      <CardContent className="pt-4 pb-4">
        <p className="text-[11px] font-medium text-alaska-muted uppercase tracking-wide">{title}</p>
        <p className={cn("text-xl font-playfair font-bold mt-1", valueClass || "text-alaska-dark")}>{value}</p>
        {gauge !== undefined && (
          <div className="mt-2 w-full bg-alaska-sage-lt rounded-full h-1.5">
            <div className="h-1.5 rounded-full bg-alaska-sage transition-all duration-700"
              style={{ width: `${Math.min(gauge, 100)}%` }}/>
          </div>
        )}
        {sub && <p className={cn("text-[11px] mt-1", subColor || "text-alaska-muted")}>{sub}</p>}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd claude && npm run build
```

Expected: compiled successfully.

- [ ] **Step 3: Commit**

```bash
git add "claude/app/(dashboard)/reporting/page.tsx"
git commit -m "feat: reporting — 4 sections (KPIs, barres, AreaChart 6 mois, donut) + export CSV"
```

---

## Task 10: Semaine Page — Full Implementation

**Files:**
- Modify: `claude/app/(dashboard)/semaine/page.tsx`

- [ ] **Step 1: Rewrite semaine/page.tsx**

```tsx
"use client"
import { useState } from "react"
import { startOfWeek, addDays, addWeeks, subWeeks, format } from "date-fns"
import { fr } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useWeekView } from "@/lib/hooks/useWeekView"
import { useWeekEntries } from "@/lib/hooks/useWeekEntries"
import { getWeeklyBreakeven } from "@/lib/calculations"
import { formatMAD } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { WeekGrid } from "@/components/saisie/WeekGrid"
import { ExpenseBar } from "@/components/ExpenseBar"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

export default function SemainePage() {
  const router = useRouter()
  const [weekStart, setWeekStart] = useState(
    startOfWeek(new Date(2026, 3, 7), { weekStartsOn: 1 })
  )

  const weekData = useWeekView(weekStart)
  const { entries, dates, updateCA, updateExpense } = useWeekEntries(weekStart)

  const weeklyBreakeven = getWeeklyBreakeven()
  const soldeSemaine = weekData.totalCA - weekData.totalDep
  const pctSeuil = weeklyBreakeven > 0 ? (weekData.totalCA / weeklyBreakeven) * 100 : 0
  const weekLabel = `${format(weekStart, "d MMM", { locale: fr })} – ${format(addDays(weekStart, 6), "d MMM yyyy", { locale: fr })}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Semaine</h1>
          <p className="text-alaska-muted text-sm mt-0.5">Vue hebdomadaire</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-alaska-sage-lt rounded-lg p-1">
          <button onClick={() => setWeekStart(w => subWeeks(w, 1))}
            className="p-1.5 hover:bg-alaska-sage-lt rounded-md transition">
            <ChevronLeft size={16} className="text-alaska-muted"/>
          </button>
          <span className="text-sm font-semibold px-3 min-w-[160px] text-center text-alaska-dark">{weekLabel}</span>
          <button onClick={() => setWeekStart(w => addWeeks(w, 1))}
            className="p-1.5 hover:bg-alaska-sage-lt rounded-md transition">
            <ChevronRight size={16} className="text-alaska-muted"/>
          </button>
        </div>
      </div>

      {/* KPIs semaine */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-white border border-alaska-sage-lt rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-[11px] text-alaska-muted uppercase tracking-wide">CA semaine</p>
            <p className="text-xl font-playfair font-bold text-alaska-dark mt-1">{formatMAD(weekData.totalCA)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border border-alaska-sage-lt rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-[11px] text-alaska-muted uppercase tracking-wide">Sorties</p>
            <p className="text-xl font-playfair font-bold text-orange-600 mt-1">{formatMAD(weekData.totalDep)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border border-alaska-sage-lt rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-[11px] text-alaska-muted uppercase tracking-wide">Solde</p>
            <p className={cn("text-xl font-playfair font-bold mt-1",
              soldeSemaine >= 0 ? "text-alaska-gold" : "text-red-600")}>
              {formatMAD(soldeSemaine)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border border-alaska-sage-lt rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-[11px] text-alaska-muted uppercase tracking-wide">% Seuil hebdo</p>
            <p className={cn("text-xl font-playfair font-bold mt-1",
              pctSeuil >= 100 ? "text-alaska-sage" : pctSeuil >= 70 ? "text-amber-600" : "text-red-600")}>
              {pctSeuil.toFixed(0)}%
            </p>
            <div className="mt-2 w-full bg-alaska-sage-lt rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-alaska-sage transition-all duration-700"
                style={{ width: `${Math.min(pctSeuil, 100)}%` }}/>
            </div>
            <p className="text-[10px] text-alaska-muted mt-1">Seuil : {formatMAD(weeklyBreakeven)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Desktop : WeekGrid éditable */}
      <div className="hidden md:block">
        <Card className="bg-white border border-alaska-sage-lt rounded-xl">
          <CardContent className="p-4">
            <WeekGrid entries={entries} dates={dates} onUpdateCA={updateCA} onUpdateExpense={updateExpense}/>
          </CardContent>
        </Card>
      </div>

      {/* Mobile : liste 7 jours */}
      <div className="md:hidden">
        <Card className="bg-white border border-alaska-sage-lt rounded-xl">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm text-alaska-dark">7 jours</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-2">
            {weekData.days.map(day => (
              <button key={day.date} onClick={() => router.push("/saisie")}
                className="w-full flex items-center justify-between p-3 bg-alaska-sage-lt/40 hover:bg-alaska-sage-lt rounded-lg transition text-left">
                <div className="flex items-center gap-3">
                  <span className="text-base">
                    {day.status === "full" ? "✅" : day.status === "partial" ? "🟡" : "⬜"}
                  </span>
                  <p className="text-sm font-medium capitalize text-alaska-dark">{day.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-playfair font-semibold text-alaska-dark">
                    {day.entry ? formatMAD(day.entry.ca_caisse) : "—"}
                  </p>
                  {day.totalExpenses > 0 && (
                    <p className="text-xs text-alaska-muted">Dép: {formatMAD(day.totalExpenses)}</p>
                  )}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Dépenses par poste */}
      {weekData.expensesByLabel.length > 0 && (
        <Card className="bg-white border border-alaska-sage-lt rounded-xl">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-base text-alaska-dark">Dépenses par poste — cette semaine</CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <ExpenseBar items={weekData.expensesByLabel} maxItems={6}/>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd claude && npm run build
```

Expected: compiled successfully, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add "claude/app/(dashboard)/semaine/page.tsx"
git commit -m "feat: semaine page — KPIs, WeekGrid desktop, liste mobile, dépenses par poste"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Design tokens: palette sage/cream/dark/gold/muted/sage-lt — Task 1
- [x] Fonts Playfair Display + DM Sans — Task 1
- [x] Layout sidebar dark + gold separator + mobile bottom nav — Task 2
- [x] Dashboard: Playfair KPIs, AreaChart sage, lever badge colors — Task 3
- [x] Saisie: tabs sage, recap dark, solde Playfair gold — Task 4
- [x] Charges: barres proportionnelles sage — Task 5
- [x] Objectifs: tabs sage, lever colors, progression Playfair — Task 6
- [x] Import: drag-drop sage, bouton sage — Task 7
- [x] ExpenseBar shared component — Task 8
- [x] Reporting 4 sections + export CSV — Task 9
- [x] Semaine KPIs + WeekGrid + liste mobile + ExpenseBar — Task 10

**Type consistency:**
- `ExpenseBar` props: `{ items: { label: string; amount: number }[], maxItems?: number }` — used identically in Tasks 9 and 10
- `useWeekEntries` returns `{ entries, dates, updateCA, updateExpense }` — matches usage in Tasks 4 and 10
- `WeekGrid` props: `{ entries, dates, onUpdateCA, onUpdateExpense }` — consistent across Tasks 4 and 10
- `getMockMonthlyCA(month)` returns `{ ca_caisse, ca_b2b }` — used in Task 9
