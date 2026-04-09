"use client"
import { useState } from "react"
import { useObjectives } from "@/lib/hooks/useObjectives"
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
  const { actions, updateActionStatus, cumulativeReal, yearlyTarget, pctAnnuel, byLever, monthlyObjectives, monthlyReal } = useObjectives()
  const [filterLever, setFilterLever] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const safeActions = Array.isArray(actions) ? actions : []
  const safeByLever = Array.isArray(byLever) ? byLever : []
  const safeMonthlyObjectives = Array.isArray(monthlyObjectives) ? monthlyObjectives : []
  const safeMonthlyReal = Array.isArray(monthlyReal) ? monthlyReal : []

  const monthlyData = safeMonthlyObjectives.map((mo) => {
    const current = safeMonthlyReal.find((item) => item.year === mo.year && item.month === mo.month)
    return { month: MONTHS_FR[mo.month - 1], target: mo.target_ca, real: current?.real || null }
  })

  const filteredActions = safeActions.filter(a =>
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
          <button key={t} onClick={() => setTab(t)}
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
                {safeMonthlyObjectives.slice(0,4).map((mo) => {
                  const real = safeMonthlyReal.find((item) => item.year === mo.year && item.month === mo.month)?.real || 0
                  const pct = mo.target_ca > 0 ? (real / mo.target_ca) * 100 : 0
                  const done = real > 0
                  return (
                    <div key={i} className="flex items-center gap-3 p-2 hover:bg-alaska-sage-lt/40 rounded-lg">
                      <span className="text-sm w-10 text-alaska-muted">{MONTHS_FR[mo.month - 1]}</span>
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
            {safeByLever.map(({ lever, total, done, pct }) => (
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
  onStatusChange: (_id: string, _status: ActionItem["status"]) => void
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
