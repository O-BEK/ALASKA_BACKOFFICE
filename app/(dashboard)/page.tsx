"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { parseImportHistoryPayload, parseObjectivesPayload } from "@/lib/contracts"
import { useDashboard } from "@/lib/hooks/useDashboard"
import type { ActionItem, ImportRecord } from "@/lib/types"
import { cn, formatMAD, formatPct } from "@/lib/utils"
import { getBreakevenColor } from "@/lib/calculations"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Activity, AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, DollarSign, Edit3, FileBarChart, ShoppingCart, UploadCloud } from "lucide-react"
import { Area, AreaChart, Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const MONTHS_FR = ["Jan", "Fév", "Mars", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]
const PRIORITY_ORDER: Record<ActionItem["priority"], number> = { urgent: 0, medium: 1, low: 2 }
const LEVER_COLORS: Record<string, string> = {
  soir: "bg-alaska-sage text-white",
  terrasse: "bg-alaska-gold text-white",
  b2b: "bg-amber-500 text-white",
  marketing: "bg-blue-500 text-white",
  pilotage: "bg-purple-500 text-white",
}
const STATUS_LABELS: Record<ActionItem["status"], string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Fait",
  cancelled: "Annulé",
}

function monthLabel(month: string) {
  if (!month) return ""
  return MONTHS_FR[parseInt(month.split("-")[1], 10) - 1] ?? ""
}

function daysInMonth(month: string) {
  const [year, rawMonth] = month.split("-").map(Number)
  if (!year || !rawMonth) return 0
  return new Date(year, rawMonth, 0).getDate()
}

function signedMAD(value: number) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : ""
  return `${prefix}${formatMAD(Math.abs(value))}`
}

function WeeklyTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: { label: string; range: string; ca_total: number; days_count: number; ca_per_day: number } }[]
}) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="rounded-lg border border-alaska-sage-lt bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-alaska-dark">{item.label} · {item.range}</p>
      <p className="mt-1 text-alaska-muted">CA : <span className="font-medium text-alaska-dark">{formatMAD(item.ca_total)}</span></p>
      <p className="text-alaska-muted">Jours saisis : <span className="font-medium text-alaska-dark">{item.days_count}</span></p>
      <p className="text-alaska-muted">CA / jour : <span className="font-medium text-alaska-dark">{formatMAD(item.ca_per_day)}</span></p>
    </div>
  )
}

export default function DashboardPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const { kpis, kpis_secondary, delta_ca, delta_expenses, delta_marge, last12, hasMonthData, monthObjective, weeklyMonth, loading, error } = useDashboard(month)
  const [actions, setActions] = useState<ActionItem[]>([])
  const [imports, setImports] = useState<ImportRecord[]>([])
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const currentMonth = new Date().toISOString().slice(0, 7)

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

  const topActions = useMemo(
    () =>
      [...actions]
        .filter((item) => item.status !== "done")
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.deadline.localeCompare(b.deadline))
        .slice(0, 3),
    [actions]
  )

  const thresholdColor = getBreakevenColor(kpis.pct_breakeven)
  const thresholdMissing = Math.max(kpis.breakeven - kpis.ca_total, 0)
  const csvMissing = month === currentMonth && !imports.some((item) => item.date_range_start.startsWith(month))
  const weeklyHasData = weeklyMonth.some((item) => item.ca_total > 0)
  const monthDays = daysInMonth(month)
  const runRateReference = monthObjective.target || kpis.breakeven
  const runRateReferenceLabel = monthObjective.target ? "objectif" : "seuil"
  const projectedMonthCa = kpis.days_count > 0 ? kpis.ca_per_day * monthDays : 0
  const projectedGap = runRateReference > 0 ? projectedMonthCa - runRateReference : 0
  const remainingCoveredDays = Math.max(monthDays - kpis.days_count, 0)
  const requiredDailyCa = runRateReference > 0 && remainingCoveredDays > 0 ? Math.max(runRateReference - kpis.ca_total, 0) / remainingCoveredDays : 0
  const runRateStatus =
    kpis.days_count === 0
      ? "À alimenter"
      : runRateReference > 0 && projectedGap < 0
        ? "À accélérer"
        : "Rythme OK"

  async function updateActionStatus(status: ActionItem["status"]) {
    if (!selectedAction) return
    setActionLoading(true)
    setActionError(null)
    try {
      const response = await fetch("/api/objectives", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedAction.id, status }),
      })
      if (!response.ok) throw new Error()
      const payload = parseObjectivesPayload(await response.json())
      setActions(payload.actions)
      setSelectedAction(payload.actions.find((item) => item.id === selectedAction.id) || null)
    } catch {
      setActionError("Impossible de mettre à jour cette action pour le moment.")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Dashboard admin</h1>
            {kpis.pct_breakeven >= 100 && <span className="rounded-full bg-alaska-sage px-2.5 py-1 text-[11px] font-semibold text-white">Seuil atteint</span>}
          </div>
          <p className="mt-1 text-sm text-alaska-muted">
            {new Intl.DateTimeFormat("fr-MA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}
          </p>
        </div>
        <div className="flex items-center gap-2 self-center rounded-lg border border-alaska-sage-lt bg-white p-1 sm:self-auto">
          <button onClick={() => {
            const [year, rawMonth] = month.split("-").map(Number)
            setMonth(rawMonth === 1 ? `${year - 1}-12` : `${year}-${String(rawMonth - 1).padStart(2, "0")}`)
          }} className="rounded-md p-1.5 transition hover:bg-alaska-sage-lt"><ChevronLeft size={16} /></button>
          <span className="min-w-[120px] px-2 text-center text-sm font-semibold text-alaska-dark">{monthLabel(month)} {month.split("-")[0]}</span>
          <button onClick={() => {
            const [year, rawMonth] = month.split("-").map(Number)
            setMonth(rawMonth === 12 ? `${year + 1}-01` : `${year}-${String(rawMonth + 1).padStart(2, "0")}`)
          }} className="rounded-md p-1.5 transition hover:bg-alaska-sage-lt"><ChevronRight size={16} /></button>
        </div>
      </div>

      {error && <Alert message={`Erreur de chargement : ${error}`} tone="red" />}
      {csvMissing && <Alert message="CSV caisse non importé pour le mois courant." tone="amber" link={{ href: "/import", label: "Importer maintenant" }} />}
      {!loading && !hasMonthData && (
        <Alert
          message="Aucune vente ni dépense sur le mois sélectionné : les indicateurs restent à zéro tant que le POS ou la saisie ne sont pas alimentés."
          tone="amber"
          link={{ href: "/import", label: "Importer le POS" }}
        />
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-alaska-sage-lt/40" />)}</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KPICard title="CA Total" value={formatMAD(kpis.ca_total)} delta={delta_ca} icon={<DollarSign size={16} className="text-alaska-sage" />} />
            <KPICard title="Dépenses" value={formatMAD(kpis.total_expenses)} delta={delta_expenses} deltaInverted icon={<ShoppingCart size={16} className="text-orange-500" />} valueClass="text-orange-600" />
            <KPICard title="Marge nette" value={formatMAD(kpis.marge_nette)} sub={delta_marge !== 0 ? `${delta_marge >= 0 ? "+" : ""}${formatMAD(Math.abs(delta_marge))} ${delta_marge >= 0 ? "↑" : "↓"} vs mois préc.` : `${kpis.taux_marge.toFixed(1)}% du CA`} icon={<Activity size={16} className={kpis.marge_nette >= 0 ? "text-alaska-sage" : "text-red-500"} />} valueClass={kpis.marge_nette >= 0 ? "text-alaska-gold" : "text-red-600"} />
            <KPICard title="CA / Jour" value={formatMAD(kpis.ca_per_day)} sub={monthObjective.target ? `Obj. ${formatMAD(monthObjective.daily_target)}` : `${kpis.days_count} jours saisis`} icon={<CalendarDays size={16} className="text-alaska-sage" />} />
          </div>

          {kpis.ca_total > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <SecondaryKPI
                label="Ticket moyen"
                value={kpis_secondary.avg_ticket > 0 ? formatMAD(kpis_secondary.avg_ticket) : "—"}
              />
              <SecondaryKPI
                label={`${kpis.days_count} / ${monthDays} jours`}
                value={`${kpis_secondary.coverage_pct.toFixed(0)}% couvert`}
              />
              <SecondaryKPI
                label="Mix espèces"
                value={kpis_secondary.mix_cash_pct > 0 ? `${kpis_secondary.mix_cash_pct.toFixed(0)}%` : "—"}
              />
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base text-alaska-dark">Rythme mensuel</CardTitle>
                        <CardDescription className="text-xs text-alaska-muted">Projection fin de mois sur {kpis.days_count} jours saisis</CardDescription>
                      </div>
                      <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", runRateStatus === "Rythme OK" ? "bg-alaska-sage-lt text-alaska-sage" : runRateStatus === "À accélérer" ? "bg-amber-100 text-amber-700" : "bg-amber-50 text-amber-700")}>
                        {runRateStatus}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <MetricBox label="Projection" value={formatMAD(projectedMonthCa)} tone="text-alaska-dark" />
                      <MetricBox label={`Écart ${runRateReferenceLabel}`} value={signedMAD(projectedGap)} tone={projectedGap >= 0 ? "text-alaska-sage" : "text-red-600"} />
                    </div>
                    <MetricBox label="CA / jour restant" value={remainingCoveredDays > 0 ? formatMAD(requiredDailyCa) : "Mois couvert"} tone="text-alaska-dark" />
                    <p className="text-xs text-alaska-muted">Basé sur le CA moyen actuel de {formatMAD(kpis.ca_per_day)} / jour.</p>
                    <Link href="/reporting"><Button variant="outline" className="w-full border-alaska-sage-lt hover:bg-alaska-sage-lt">Voir le reporting</Button></Link>
                  </CardContent>
                </Card>

                <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-alaska-dark">Objectif mensuel</CardTitle>
                    <CardDescription className="text-xs text-alaska-muted">Progression sur {monthLabel(month)} {month.split("-")[0]}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {monthObjective.target ? (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div><p className="text-[11px] uppercase tracking-wide text-alaska-muted">Réalisé</p><p className="mt-1 text-xl font-playfair font-bold text-alaska-dark">{formatMAD(monthObjective.real)}</p></div>
                          <div className="text-right"><p className="text-[11px] uppercase tracking-wide text-alaska-muted">Cible</p><p className="mt-1 text-lg font-playfair font-bold text-alaska-sage">{formatMAD(monthObjective.target)}</p></div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-alaska-muted"><span>{monthObjective.pct.toFixed(0)}% atteint</span><span>Reste {formatMAD(monthObjective.remaining)}</span></div>
                          <div className="h-2 rounded-full bg-alaska-sage-lt"><div className="h-2 rounded-full bg-alaska-sage" style={{ width: `${Math.min(monthObjective.pct, 100)}%` }} /></div>
                        </div>
                        <p className="text-xs text-alaska-muted">Objectif / jour : {formatMAD(monthObjective.daily_target)}</p>
                        {monthObjective.note && <p className="rounded-lg bg-alaska-dark/5 px-3 py-2 text-xs text-alaska-dark">{monthObjective.note}</p>}
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-alaska-muted">Aucun objectif mensuel configuré pour cette période.</p>
                        <Link href="/objectifs"><Button variant="outline" className="w-full border-alaska-sage-lt hover:bg-alaska-sage-lt">Configurer les objectifs</Button></Link>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-alaska-dark">Seuil de rentabilité</CardTitle>
                  <CardDescription className="text-xs text-alaska-muted">{thresholdColor === "green" ? "Seuil atteint" : thresholdColor === "orange" ? "Proche du seuil" : "En dessous du seuil"} · {formatMAD(kpis.ca_total)} sur {formatMAD(kpis.breakeven)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="h-3 rounded-full bg-alaska-sage-lt"><div className={cn("h-3 rounded-full", thresholdColor === "green" ? "bg-alaska-sage" : thresholdColor === "orange" ? "bg-amber-500" : "bg-red-500")} style={{ width: `${Math.min(kpis.pct_breakeven, 100)}%` }} /></div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MetricBox label="Progression" value={`${kpis.pct_breakeven.toFixed(0)}%`} tone="text-alaska-dark" />
                    <MetricBox label="Reste à couvrir" value={formatMAD(thresholdMissing)} tone="text-alaska-dark" />
                    <MetricBox label="Seuil mensuel" value={formatMAD(kpis.breakeven)} tone="text-alaska-dark" />
                  </div>
                </CardContent>
              </Card>

              {hasMonthData ? (
                <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-alaska-dark">CA semaine par semaine</CardTitle>
                    <CardDescription className="text-xs text-alaska-muted">Lecture hebdomadaire du mois sélectionné</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {weeklyHasData ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={weeklyMonth}>
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7a7a6a" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: "#7a7a6a" }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                          <Tooltip content={<WeeklyTooltip />} />
                          <ReferenceLine y={weeklyMonth[0]?.breakeven || 0} stroke="#c9a96e" strokeDasharray="4 4" />
                          <Bar dataKey="ca_total" radius={[8, 8, 0, 0]}>{weeklyMonth.map((item) => <Cell key={item.label} fill={item.ca_total >= item.breakeven ? "#4a6741" : "#e6a830"} />)}</Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="py-10 text-center text-sm text-alaska-muted">Pas encore assez de données pour afficher le comparatif semaine par semaine.</p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-xl border border-dashed border-alaska-sage bg-white">
                  <CardContent className="space-y-4 py-10 text-center">
                    <p className="font-medium text-alaska-dark">Aucune donnée sur cette période</p>
                    <p className="text-sm text-alaska-muted">Importe le CSV caisse ou saisis les dépenses pour commencer à piloter ce mois.</p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                      <Link href="/import"><Button className="bg-alaska-sage hover:bg-alaska-sage/90">Importer le CSV</Button></Link>
                      <Link href="/saisie"><Button variant="outline" className="border-alaska-sage-lt hover:bg-alaska-sage-lt">Aller en saisie</Button></Link>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { href: "/import", icon: UploadCloud, label: "Importer CSV", tone: "text-alaska-sage" },
                  { href: "/saisie", icon: Edit3, label: "Saisir les dépenses", tone: "text-alaska-gold" },
                  { href: "/reporting", icon: FileBarChart, label: "Voir le rapport", tone: "text-alaska-sage" },
                ].map(({ href, icon: Icon, label, tone }) => (
                  <Link key={href} href={href}>
                    <Button variant="outline" className="h-14 w-full justify-start gap-3 border-alaska-sage-lt bg-white hover:border-alaska-sage hover:bg-alaska-sage-lt/50">
                      <Icon size={18} className={tone} />
                      <span className="text-sm text-alaska-dark">{label}</span>
                    </Button>
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-alaska-dark">CA Total — 12 derniers mois</CardTitle>
                  <CardDescription className="text-xs text-alaska-muted">Seuil mensuel en repère</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={last12} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs><linearGradient id="gradSage" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4a6741" stopOpacity={0.15} /><stop offset="95%" stopColor="#4a6741" stopOpacity={0} /></linearGradient></defs>
                      <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11, fill: "#7a7a6a" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#7a7a6a" }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value: number) => formatMAD(value)} labelFormatter={monthLabel} contentStyle={{ borderRadius: "8px", border: "1px solid #e8ede7", fontSize: "12px" }} />
                      <ReferenceLine y={kpis.breakeven} stroke="#c9a96e" strokeDasharray="4 4" />
                      <Area type="monotone" dataKey="ca_total" stroke="#4a6741" strokeWidth={2.5} fill="url(#gradSage)" dot={{ r: 3, fill: "#4a6741" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between"><CardTitle className="text-base text-alaska-dark">Top 3 actions prioritaires</CardTitle><Link href="/objectifs" className="text-xs font-medium text-alaska-sage hover:underline">Voir toutes</Link></div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topActions.length > 0 ? topActions.map((action) => (
                    <button key={action.id} onClick={() => setSelectedAction(action)} className="w-full rounded-lg border border-alaska-sage-lt bg-alaska-sage-lt/40 p-3 text-left transition hover:border-alaska-sage hover:bg-alaska-sage-lt/70">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", LEVER_COLORS[action.lever] || "bg-gray-200 text-gray-700")}>{action.lever}</span>
                            <span className={cn("text-[11px] font-medium", action.priority === "urgent" ? "text-red-500" : action.priority === "medium" ? "text-amber-600" : "text-alaska-sage")}>{action.priority === "urgent" ? "URGENT" : action.priority === "medium" ? "MOYEN" : "FAIBLE"}</span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-alaska-dark">{action.title}</p>
                          <p className="mt-1 text-xs text-alaska-muted">{action.deadline}</p>
                        </div>
                      </div>
                    </button>
                  )) : <p className="py-8 text-center text-sm text-alaska-muted">Aucune action prioritaire à afficher.</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {selectedAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", LEVER_COLORS[selectedAction.lever] || "bg-gray-200 text-gray-700")}>{selectedAction.lever}</span>
                  <span className="text-xs text-alaska-muted">{selectedAction.deadline}</span>
                </div>
                <h2 className="mt-3 font-playfair text-xl font-bold text-alaska-dark">{selectedAction.title}</h2>
              </div>
              <button onClick={() => setSelectedAction(null)} className="rounded-full border border-alaska-sage-lt px-2.5 py-1 text-sm text-alaska-muted hover:bg-alaska-sage-lt">Fermer</button>
            </div>
            <div className="mt-5 space-y-4">
              {selectedAction.description && <p className="text-sm leading-6 text-alaska-dark">{selectedAction.description}</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricBox label="Priorité" value={selectedAction.priority === "urgent" ? "Urgente" : selectedAction.priority === "medium" ? "Moyenne" : "Faible"} tone="text-alaska-dark" />
                <MetricBox label="Statut" value={STATUS_LABELS[selectedAction.status]} tone="text-alaska-dark" />
                <MetricBox label="Impact" value={selectedAction.impact || "Non renseigné"} tone="text-alaska-dark" />
                <MetricBox label="Budget" value={selectedAction.budget_max > 0 ? selectedAction.budget_min === selectedAction.budget_max ? formatMAD(selectedAction.budget_max) : `${formatMAD(selectedAction.budget_min)} – ${formatMAD(selectedAction.budget_max)}` : "Non défini"} tone="text-alaska-dark" />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-alaska-muted">Changer le statut</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["todo", "in_progress", "done"] as const).map((status) => (
                    <button key={status} onClick={() => updateActionStatus(status)} className={cn("rounded-lg border px-3 py-2 text-xs font-medium transition", selectedAction.status === status ? "border-alaska-sage bg-alaska-sage text-white" : "border-alaska-sage-lt bg-white text-alaska-muted hover:bg-alaska-sage-lt")}>{STATUS_LABELS[status]}</button>
                  ))}
                </div>
                {actionLoading && <p className="text-xs text-alaska-muted">Mise à jour en cours...</p>}
                {actionError && <p className="text-xs text-red-500">{actionError}</p>}
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" className="border-alaska-sage-lt hover:bg-alaska-sage-lt" onClick={() => setSelectedAction(null)}>Fermer</Button>
              <Link href="/objectifs"><Button className="w-full bg-alaska-sage hover:bg-alaska-sage/90 sm:w-auto">Ouvrir le plan complet</Button></Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Alert({
  message,
  tone,
  link,
}: {
  message: string
  tone: "red" | "amber"
  link?: { href: string; label: string }
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl px-4 py-3 text-sm", tone === "red" ? "border border-red-200 bg-red-50 text-red-800" : "border border-amber-200 bg-amber-50 text-amber-800")}>
      <AlertTriangle size={16} />
      <span>
        {message}{" "}
        {link && <Link href={link.href} className="font-medium underline">{link.label}</Link>}
      </span>
    </div>
  )
}

function KPICard({
  title,
  value,
  sub,
  delta,
  deltaInverted,
  icon,
  valueClass,
}: {
  title: string
  value: string
  sub?: string
  delta?: number
  deltaInverted?: boolean
  icon: ReactNode
  valueClass?: string
}) {
  return (
    <Card className="rounded-xl border border-alaska-sage-lt bg-white">
      <CardContent className="pt-4 pb-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wide text-alaska-muted">{title}</p>
          {icon}
        </div>
        <p className={cn("text-xl font-playfair font-bold", valueClass || "text-alaska-dark")}>{value}</p>
        {delta !== undefined && (
          <p className={cn(
            "mt-1 text-xs",
            deltaInverted
              ? delta <= 0 ? "text-alaska-sage" : "text-red-500"
              : delta >= 0 ? "text-alaska-sage" : "text-red-500"
          )}>
            {formatPct(delta)} vs mois précédent
          </p>
        )}
        {sub && <p className="mt-1 text-[11px] text-alaska-muted">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function MetricBox({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-alaska-sage-lt bg-white px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-alaska-muted">{label}</p>
      <p className={cn("mt-1 text-sm font-medium", tone)}>{value}</p>
    </div>
  )
}

function SecondaryKPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-alaska-sage-lt bg-white px-3 py-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-alaska-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-alaska-dark">{value}</p>
    </div>
  )
}
