"use client"

import { useEffect, useMemo, useState } from "react"
import { formatMAD } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ExpenseBar } from "@/components/ExpenseBar"
import { cn } from "@/lib/utils"

const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
const PIE_COLORS = ["#4a6741", "#c9a96e", "#e6a830", "#7a7a6a"]

function prevMonthStr(month: string): string {
  const [year, rawMonth] = month.split("-").map(Number)
  return rawMonth === 1 ? `${year - 1}-12` : `${year}-${String(rawMonth - 1).padStart(2, "0")}`
}

interface ReportingPayload {
  monthCA: number
  prevCA: number
  monthExp: number
  expByLabel: { label: string; amount: number }[]
  byCategory: { name: string; value: number }[]
  pctSeuil: number
  soldeMois: number
  last6: { month: string; ca: number; objectif: number | null }[]
}

export default function ReportingPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [payload, setPayload] = useState<ReportingPayload>({
    monthCA: 0,
    prevCA: 0,
    monthExp: 0,
    expByLabel: [],
    byCategory: [],
    pctSeuil: 0,
    soldeMois: 0,
    last6: [],
  })

  useEffect(() => {
    fetch(`/api/reporting?month=${month}`)
      .then(async (response) => {
        const data = (await response.json()) as Partial<ReportingPayload>
        return {
          monthCA: typeof data.monthCA === "number" ? data.monthCA : 0,
          prevCA: typeof data.prevCA === "number" ? data.prevCA : 0,
          monthExp: typeof data.monthExp === "number" ? data.monthExp : 0,
          expByLabel: Array.isArray(data.expByLabel) ? data.expByLabel : [],
          byCategory: Array.isArray(data.byCategory) ? data.byCategory : [],
          pctSeuil: typeof data.pctSeuil === "number" ? data.pctSeuil : 0,
          soldeMois: typeof data.soldeMois === "number" ? data.soldeMois : 0,
          last6: Array.isArray(data.last6) ? data.last6 : [],
        } satisfies ReportingPayload
      })
      .then((data) => setPayload(data))
      .catch(() =>
        setPayload({
          monthCA: 0,
          prevCA: 0,
          monthExp: 0,
          expByLabel: [],
          byCategory: [],
          pctSeuil: 0,
          soldeMois: 0,
          last6: [],
        })
      )
  }, [month])

  const [year, rawMonth] = month.split("-").map(Number)
  const pctVsPrev = payload.prevCA > 0 ? ((payload.monthCA - payload.prevCA) / payload.prevCA) * 100 : 0

  const exportCSV = () => {
    window.open(`/api/reporting/export?month=${month}`, "_blank")
  }

  const heading = useMemo(() => `${MONTHS_FR[rawMonth - 1]} ${year}`, [rawMonth, year])

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Reporting</h1>
          <p className="text-alaska-muted text-sm mt-1">Analyse mensuelle</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-alaska-sage-lt rounded-lg p-1">
          <button onClick={() => setMonth(prevMonthStr(month))} className="p-1.5 hover:bg-alaska-sage-lt rounded-md transition">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold px-2 min-w-[140px] text-center text-alaska-dark">{heading}</span>
          <button
            onClick={() => setMonth(rawMonth === 12 ? `${year + 1}-01` : `${year}-${String(rawMonth + 1).padStart(2, "0")}`)}
            className="p-1.5 hover:bg-alaska-sage-lt rounded-md transition"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <RKPICard
          title="CA Caisse"
          value={formatMAD(payload.monthCA)}
          sub={`${pctVsPrev >= 0 ? "+" : ""}${pctVsPrev.toFixed(0)}% vs préc.`}
          subColor={pctVsPrev >= 0 ? "text-alaska-sage" : "text-red-500"}
        />
        <RKPICard title="Dépenses" value={formatMAD(payload.monthExp)} valueClass="text-orange-600" />
        <RKPICard title="Solde" value={formatMAD(payload.soldeMois)} valueClass={payload.soldeMois >= 0 ? "text-alaska-gold" : "text-red-600"} />
        <RKPICard
          title="% Seuil"
          value={`${payload.pctSeuil.toFixed(0)}%`}
          gauge={payload.pctSeuil}
          valueClass={payload.pctSeuil >= 100 ? "text-alaska-sage" : payload.pctSeuil >= 70 ? "text-amber-600" : "text-red-600"}
        />
      </div>

      <Card className="bg-white border border-alaska-sage-lt rounded-xl">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base text-alaska-dark">Dépenses par poste</CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <ExpenseBar items={payload.expByLabel} maxItems={8} />
        </CardContent>
      </Card>

      <Card className="bg-white border border-alaska-sage-lt rounded-xl">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base text-alaska-dark">Évolution CA — 6 mois</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={payload.last6} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCA6" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4a6741" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#4a6741" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#7a7a6a" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#7a7a6a" }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value: number) => formatMAD(value)} contentStyle={{ borderRadius: "8px", border: "1px solid #e8ede7", fontSize: "12px" }} />
              <Area type="monotone" dataKey="ca" stroke="#4a6741" strokeWidth={2.5} fill="url(#gradCA6)" name="CA réel" dot={{ r: 3, fill: "#4a6741" }} />
              <Area type="monotone" dataKey="objectif" stroke="#c9a96e" strokeWidth={1.5} strokeDasharray="5 5" fill="none" name="Objectif" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-white border border-alaska-sage-lt rounded-xl">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base text-alaska-dark">Répartition des dépenses</CardTitle>
        </CardHeader>
        <CardContent>
          {Array.isArray(payload.byCategory) && payload.byCategory.some((item) => item && item.value > 0) ? (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={payload.byCategory} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {payload.byCategory.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatMAD(value)} contentStyle={{ borderRadius: "8px", border: "1px solid #e8ede7", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {payload.byCategory.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[index] }} />
                    <span className="text-sm text-alaska-dark flex-1">{item.name}</span>
                    <span className="text-sm font-playfair font-semibold text-alaska-dark">{formatMAD(item.value)}</span>
                    <span className="text-xs text-alaska-muted w-10 text-right">
                      {payload.monthExp > 0 ? `${((item.value / payload.monthExp) * 100).toFixed(0)}%` : "—"}
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

      <Button variant="outline" className="w-full justify-start gap-3 h-12 border-alaska-sage-lt hover:bg-alaska-sage-lt bg-white" onClick={exportCSV}>
        <Download size={18} className="text-alaska-sage" />
        <div className="text-left">
          <p className="text-sm font-medium text-alaska-dark">Exporter CSV</p>
          <p className="text-xs text-alaska-muted">CA + dépenses par poste — {heading}</p>
        </div>
      </Button>
    </div>
  )
}

function RKPICard({
  title,
  value,
  sub,
  subColor,
  valueClass,
  gauge,
}: {
  title: string
  value: string
  sub?: string
  subColor?: string
  valueClass?: string
  gauge?: number
}) {
  return (
    <Card className="bg-white border border-alaska-sage-lt rounded-xl">
      <CardContent className="pt-4 pb-4">
        <p className="text-[11px] font-medium text-alaska-muted uppercase tracking-wide">{title}</p>
        <p className={cn("text-xl font-playfair font-bold mt-1", valueClass || "text-alaska-dark")}>{value}</p>
        {gauge !== undefined && (
          <div className="mt-2 w-full bg-alaska-sage-lt rounded-full h-1.5">
            <div className="h-1.5 rounded-full bg-alaska-sage transition-all duration-700" style={{ width: `${Math.min(gauge, 100)}%` }} />
          </div>
        )}
        {sub && <p className={cn("text-[11px] mt-1", subColor || "text-alaska-muted")}>{sub}</p>}
      </CardContent>
    </Card>
  )
}
