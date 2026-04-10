"use client"
import { useEffect, useState } from "react"
import { parseImportHistoryPayload, parseObjectivesPayload } from "@/lib/contracts"
import { useDashboard } from "@/lib/hooks/useDashboard"
import type { ActionItem, ImportRecord } from "@/lib/types"
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
function monthLabel(m: string) { if (!m) return ""; const [,mo] = m.split("-"); return MONTHS_FR[parseInt(mo)-1] ?? "" }

const LEVER_COLORS: Record<string, string> = {
  soir: "bg-alaska-sage text-white",
  terrasse: "bg-alaska-gold text-white",
  b2b: "bg-amber-500 text-white",
  marketing: "bg-blue-500 text-white",
  pilotage: "bg-purple-500 text-white",
}

export default function DashboardPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const { kpis, delta_ca, last12, error: dashboardError } = useDashboard(month)
  const [actions, setActions] = useState<ActionItem[]>([])
  const [imports, setImports] = useState<ImportRecord[]>([])
  const safeActions = Array.isArray(actions) ? actions : []
  const safeImports = Array.isArray(imports) ? imports : []
  const safeLast12 = Array.isArray(last12) ? last12 : []
  const soldeCaisse = kpis.ca_caisse - kpis.total_expenses
  const tauxSolde = kpis.ca_total > 0 ? (soldeCaisse / kpis.ca_total) * 100 : 0

  const prevMonth = () => {
    const [y, m] = month.split("-").map(Number)
    setMonth(m === 1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,"0")}`)
  }
  const nextMonth = () => {
    const [y, m] = month.split("-").map(Number)
    setMonth(m === 12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,"0")}`)
  }

  useEffect(() => {
    fetch("/api/objectives")
      .then(async (response) => parseObjectivesPayload(await response.json()))
      .then((payload) => setActions(payload.actions))
      .catch(() => setActions([]))
    fetch("/api/import-csv")
      .then(async (response) => parseImportHistoryPayload(await response.json()))
      .then((payload) => setImports(payload.history))
      .catch(() => setImports([]))
  }, [])

  const bColor = getBreakevenColor(kpis.pct_breakeven)
  const topActions = safeActions.filter((a) => a.status !== "done").slice(0, 3)
  const csvMissing = !safeImports.some((item) => {
    if (!item || typeof item !== "object") return false
    const start = typeof item.date_range_start === "string" ? item.date_range_start : ""
    return start.startsWith(month)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Bonjour Othman</h1>
          <p className="text-alaska-muted text-sm mt-0.5">Tableau de bord — Alaska Neo Bistrot</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-alaska-sage-lt rounded-lg p-1 self-center sm:self-auto">
          <button onClick={prevMonth} className="p-1.5 hover:bg-alaska-sage-lt rounded-md transition"><ChevronLeft size={16}/></button>
          <span className="text-sm font-semibold px-2 min-w-[90px] text-center text-alaska-dark">
            {MONTHS_FR[parseInt(month.split("-")[1])-1]} {month.split("-")[0]}
          </span>
          <button onClick={nextMonth} className="p-1.5 hover:bg-alaska-sage-lt rounded-md transition"><ChevronRight size={16}/></button>
        </div>
      </div>

      {dashboardError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-800 text-sm">
          <AlertTriangle size={16}/>
          <span>Erreur de chargement : {dashboardError}</span>
        </div>
      )}

      {csvMissing && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800 text-sm">
          <AlertTriangle size={16}/>
          <span>CSV caisse non importé pour ce mois — <Link href="/import" className="underline font-medium">Importer maintenant</Link></span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard title="CA Total" value={formatMAD(kpis.ca_total)} delta={delta_ca}
          icon={<DollarSign size={16} className="text-alaska-sage"/>}/>
        <KPICard title="Dépenses" value={formatMAD(kpis.total_expenses)}
          icon={<ShoppingCart size={16} className="text-orange-500"/>} valueClass="text-orange-600"/>
        <KPICard title="Solde caisse" value={formatMAD(soldeCaisse)}
          sub={`${tauxSolde.toFixed(1)}% du CA`}
          icon={<Activity size={16} className={soldeCaisse >= 0 ? "text-alaska-sage" : "text-red-500"}/>}
          valueClass={soldeCaisse >= 0 ? "text-alaska-gold" : "text-red-600"}/>
        <KPICard title="Seuil"
          value={`${kpis.pct_breakeven.toFixed(0)}%`}
          sub={`${formatMAD(kpis.ca_total)} / ${formatMAD(kpis.breakeven)}`}
          icon={<Target size={16} className="text-alaska-sage"/>}
          valueClass={bColor === "green" ? "text-alaska-sage" : bColor === "orange" ? "text-amber-600" : "text-red-600"}
          gauge={kpis.pct_breakeven}/>
      </div>

      {/* AreaChart CA 12 mois */}
      <Card className="bg-white border border-alaska-sage-lt rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-alaska-dark">CA Total — 12 derniers mois</CardTitle>
          <CardDescription className="text-xs text-alaska-muted">Ligne tiretée = seuil de rentabilité</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={safeLast12} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
              <Area type="monotone" dataKey="ca_total" stroke="#4a6741" strokeWidth={2.5} fill="url(#gradSage)"
                dot={{ r: 3, fill: "#4a6741" }} name="CA Total"/>
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
