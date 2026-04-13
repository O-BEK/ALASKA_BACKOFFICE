"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"
import { parseReportingPayload } from "@/lib/contracts"
import { cn, formatMAD, formatPct } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Download, FileText, Scale, StickyNote, TrendingUp, Users } from "lucide-react"
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ExpenseBar } from "@/components/ExpenseBar"

const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
const PIE_COLORS = ["#4a6741", "#c9a96e", "#e6a830", "#7a7a6a"]
const CATEGORY_LABELS: Record<string, string> = {
  MP: "Matières premières",
  RH: "Personnel",
  CHARGES: "Charges",
  AUTRE: "Autres",
}
const EMPTY_REPORTING = parseReportingPayload({})

type ReportingPayload = ReturnType<typeof parseReportingPayload>

function moveMonth(month: string, delta: number) {
  const [year, rawMonth] = month.split("-").map(Number)
  const current = new Date(year, rawMonth - 1 + delta, 1)
  return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`
}

function exportFile(month: string, type: "monthly" | "expenses" | "comparison") {
  const year = month.split("-")[0]
  window.open(`/api/reporting/export?month=${month}&year=${year}&type=${type}`, "_blank")
}

export default function ReportingPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [payload, setPayload] = useState<ReportingPayload>(EMPTY_REPORTING)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    setLoading(true)
    setError(null)

    fetch(`/api/reporting?month=${month}`)
      .then(async (response) => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`)
        return parseReportingPayload(json)
      })
      .then((data) => {
        if (!active) return
        setPayload(data)
      })
      .catch((err: unknown) => {
        if (!active) return
        setPayload(EMPTY_REPORTING)
        setError(err instanceof Error ? err.message : "Impossible de charger le reporting.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [month])

  const [year, rawMonth] = month.split("-").map(Number)
  const heading = useMemo(() => `${MONTHS_FR[rawMonth - 1]} ${year}`, [rawMonth, year])
  const summary = payload.summary
  const hasExpenses = payload.expByLabel.some((item) => item.amount > 0)
  const hasCategoryBreakdown = payload.byCategory.some((item) => item.value > 0)

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Reporting</h1>
          <p className="mt-1 text-sm text-alaska-muted">Vue mensuelle de pilotage et exports rapides</p>
        </div>
        <div className="flex items-center gap-2 self-center rounded-lg border border-alaska-sage-lt bg-white p-1 lg:self-auto">
          <button onClick={() => setMonth(moveMonth(month, -1))} className="rounded-md p-1.5 transition hover:bg-alaska-sage-lt">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[160px] px-2 text-center text-sm font-semibold text-alaska-dark">{heading}</span>
          <button onClick={() => setMonth(moveMonth(month, 1))} className="rounded-md p-1.5 transition hover:bg-alaska-sage-lt">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ReportingKpiCard
          title="CA total"
          value={formatMAD(summary.ca_total)}
          sub={`${formatPct(summary.prev_pct)} vs mois précédent`}
          subColor={summary.prev_pct >= 0 ? "text-alaska-sage" : "text-red-500"}
        />
        <ReportingKpiCard
          title="Dépenses"
          value={formatMAD(summary.total_expenses)}
          valueClass="text-orange-600"
          sub={`${payload.expByLabel.length} poste(s) saisi(s)`}
        />
        <ReportingKpiCard
          title="Marge nette"
          value={formatMAD(summary.marge_nette)}
          valueClass={summary.marge_nette >= 0 ? "text-alaska-gold" : "text-red-600"}
          sub={`${summary.taux_marge.toFixed(1)}% du CA`}
        />
        <ReportingKpiCard
          title="% seuil"
          value={`${summary.pct_seuil.toFixed(0)}%`}
          sub={`${formatMAD(summary.breakeven)} de seuil mensuel`}
          gauge={summary.pct_seuil}
          valueClass={summary.pct_seuil >= 100 ? "text-alaska-sage" : summary.pct_seuil >= 70 ? "text-amber-600" : "text-red-600"}
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-60 animate-pulse rounded-xl bg-alaska-sage-lt/40" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
            <div className="space-y-6">
              <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-alaska-dark">Synthèse mensuelle</CardTitle>
                  <CardDescription className="text-xs text-alaska-muted">Lecture rapide du mois sélectionné</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricBox label="CA caisse" value={formatMAD(summary.ca_caisse)} icon={<TrendingUp size={16} className="text-alaska-sage" />} />
                  <MetricBox label="CA B2B" value={formatMAD(summary.ca_b2b)} icon={<Users size={16} className="text-alaska-gold" />} />
                  <MetricBox label="CA soir" value={`${formatMAD(summary.ca_soir)} · ${summary.pct_soir.toFixed(0)}%`} icon={<FileText size={16} className="text-alaska-sage" />} />
                  <MetricBox label="CA / jour" value={`${formatMAD(summary.ca_per_day)} · ${summary.days_count} jour(s)`} icon={<Scale size={16} className="text-alaska-sage" />} />
                  <MetricBox label="vs mois préc." value={summary.prev_total > 0 ? `${formatMAD(summary.prev_total)} · ${formatPct(summary.prev_pct)}` : "Pas d'historique"} />
                  <MetricBox label="vs N-1" value={summary.prev_year_total > 0 ? `${formatMAD(summary.prev_year_total)} · ${formatPct(summary.prev_year_pct)}` : "Pas d'historique"} />
                  <MetricBox label="Solde mois" value={formatMAD(summary.solde_mois)} tone={summary.solde_mois >= 0 ? "text-alaska-dark" : "text-red-600"} />
                  <MetricBox label="Seuil couvert" value={`${summary.pct_seuil.toFixed(0)}%`} tone={summary.pct_seuil >= 100 ? "text-alaska-sage" : "text-alaska-dark"} />
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-alaska-dark">Dépenses par poste</CardTitle>
                  <CardDescription className="text-xs text-alaska-muted">Top des postes saisis sur le mois</CardDescription>
                </CardHeader>
                <CardContent>
                  <ExpenseBar items={payload.expByLabel} maxItems={10} />
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-alaska-dark">Évolution CA — 6 derniers mois</CardTitle>
                  <CardDescription className="text-xs text-alaska-muted">CA réel vs objectif mensuel</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
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

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-alaska-dark">Paiements personnel</CardTitle>
                    <CardDescription className="text-xs text-alaska-muted">Charges staff vs dépenses saisies</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {payload.staffPayments.length > 0 ? (
                      <div className="space-y-2">
                        {payload.staffPayments.map((item) => (
                          <div key={item.name} className="rounded-lg border border-alaska-sage-lt bg-alaska-sage-lt/30 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-alaska-dark">{item.name}</p>
                              <p className={cn("text-sm font-semibold", item.delta === 0 ? "text-alaska-sage" : item.delta > 0 ? "text-red-500" : "text-amber-700")}>
                                {item.delta === 0 ? "Aligné" : formatMAD(item.delta)}
                              </p>
                            </div>
                            <p className="mt-1 text-xs text-alaska-muted">
                              Théorique {formatMAD(item.theoretical)} · Saisi {formatMAD(item.actual)}
                              {item.payment_day ? ` · Jour ${item.payment_day}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-8 text-center text-sm text-alaska-muted">Aucun paiement staff configuré ou saisi sur ce mois.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-alaska-dark">Notes du mois</CardTitle>
                    <CardDescription className="text-xs text-alaska-muted">Notes opérationnelles saisies au fil des jours</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {payload.notes.length > 0 ? (
                      <div className="space-y-2">
                        {payload.notes.map((item) => (
                          <div key={`${item.date}-${item.note}`} className="rounded-lg border border-alaska-sage-lt bg-white px-3 py-3">
                            <div className="flex items-center gap-2 text-xs text-alaska-muted">
                              <StickyNote size={14} />
                              <span>{item.date}</span>
                            </div>
                            <p className="mt-2 text-sm text-alaska-dark">{item.note}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-8 text-center text-sm text-alaska-muted">Aucune note renseignée pour cette période.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="space-y-6">
              <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-alaska-dark">Exports rapides</CardTitle>
                  <CardDescription className="text-xs text-alaska-muted">CSV prêts à partager ou retraiter</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ExportButton title="CSV rapport mensuel" description={`CA + dépenses + notes — ${heading}`} onClick={() => exportFile(month, "monthly")} />
                  <ExportButton title="CSV toutes dépenses" description={`Détail des dépenses — ${heading}`} onClick={() => exportFile(month, "expenses")} />
                  <ExportButton title="CSV comparaison annuelle" description={`Comparaison ${year} vs ${year - 1}`} onClick={() => exportFile(month, "comparison")} />
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-alaska-dark">Répartition des dépenses</CardTitle>
                  <CardDescription className="text-xs text-alaska-muted">Lecture par catégorie comptable</CardDescription>
                </CardHeader>
                <CardContent>
                  {hasCategoryBreakdown ? (
                    <div className="flex flex-col items-center gap-6">
                      <ResponsiveContainer width="100%" height={190}>
                        <PieChart>
                          <Pie data={payload.byCategory} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={3}>
                            {payload.byCategory.map((_, index) => (
                              <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatMAD(value)} contentStyle={{ borderRadius: "8px", border: "1px solid #e8ede7", fontSize: "12px" }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="w-full space-y-2">
                        {payload.byCategory.map((item, index) => (
                          <div key={item.name} className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                            <span className="flex-1 text-sm text-alaska-dark">{CATEGORY_LABELS[item.name] || item.name}</span>
                            <span className="text-sm font-medium text-alaska-dark">{formatMAD(item.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="py-8 text-center text-sm text-alaska-muted">Aucune dépense saisie pour ce mois.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-alaska-dark">Réconciliation charges</CardTitle>
                  <CardDescription className="text-xs text-alaska-muted">Théorique vs réellement saisi</CardDescription>
                </CardHeader>
                <CardContent>
                  {payload.chargeReconciliation.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px] text-sm">
                        <thead>
                          <tr className="border-b border-alaska-sage-lt text-left text-xs uppercase tracking-wide text-alaska-muted">
                            <th className="pb-2 font-medium">Poste</th>
                            <th className="pb-2 font-medium">Théorique</th>
                            <th className="pb-2 font-medium">Saisi</th>
                            <th className="pb-2 font-medium">Écart</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payload.chargeReconciliation.map((item) => (
                            <tr key={item.name} className="border-b border-alaska-sage-lt/70 last:border-b-0">
                              <td className="py-3">
                                <p className="font-medium text-alaska-dark">{item.name}</p>
                                <p className="text-xs text-alaska-muted">{item.category}{item.payment_day ? ` · Jour ${item.payment_day}` : ""}</p>
                              </td>
                              <td className="py-3 text-alaska-dark">{formatMAD(item.theoretical)}</td>
                              <td className="py-3 text-alaska-dark">{formatMAD(item.actual)}</td>
                              <td className={cn("py-3 font-medium", item.delta === 0 ? "text-alaska-sage" : item.delta > 0 ? "text-red-500" : "text-amber-700")}>
                                {item.delta === 0 ? "0 MAD" : formatMAD(item.delta)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="py-8 text-center text-sm text-alaska-muted">Aucune charge active à réconcilier pour ce mois.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="rounded-xl border border-alaska-sage-lt bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-alaska-dark">Comparaison {year} vs {year - 1}</CardTitle>
              <CardDescription className="text-xs text-alaska-muted">Lecture mois par mois de l&apos;année courante</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-alaska-sage-lt text-left text-xs uppercase tracking-wide text-alaska-muted">
                      <th className="pb-2 font-medium">Mois</th>
                      <th className="pb-2 font-medium">{year - 1}</th>
                      <th className="pb-2 font-medium">{year}</th>
                      <th className="pb-2 font-medium">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.comparison.map((item) => (
                      <tr key={item.month} className="border-b border-alaska-sage-lt/70 last:border-b-0">
                        <td className="py-3 font-medium text-alaska-dark">{item.month}</td>
                        <td className="py-3 text-alaska-dark">{formatMAD(item.previous)}</td>
                        <td className="py-3 text-alaska-dark">{formatMAD(item.current)}</td>
                        <td className={cn("py-3 font-medium", item.delta_pct === null ? "text-alaska-muted" : item.delta_pct >= 0 ? "text-alaska-sage" : "text-red-500")}>
                          {item.delta_pct === null ? "—" : formatPct(item.delta_pct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {!hasExpenses && (
            <Card className="rounded-xl border border-dashed border-alaska-sage bg-white">
              <CardContent className="py-8 text-center">
                <p className="font-medium text-alaska-dark">Aucune dépense détaillée sur cette période</p>
                <p className="mt-1 text-sm text-alaska-muted">Le rapport reste consultable, mais les réconciliations et exports seront plus utiles une fois les dépenses saisies.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function ReportingKpiCard({
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
    <Card className="rounded-xl border border-alaska-sage-lt bg-white">
      <CardContent className="pt-4 pb-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-alaska-muted">{title}</p>
        <p className={cn("mt-1 text-xl font-playfair font-bold text-alaska-dark", valueClass)}>{value}</p>
        {gauge !== undefined && (
          <div className="mt-2 h-1.5 w-full rounded-full bg-alaska-sage-lt">
            <div className="h-1.5 rounded-full bg-alaska-sage transition-all duration-700" style={{ width: `${Math.min(gauge, 100)}%` }} />
          </div>
        )}
        {sub && <p className={cn("mt-1 text-[11px] text-alaska-muted", subColor)}>{sub}</p>}
      </CardContent>
    </Card>
  )
}

function MetricBox({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: string
  tone?: string
  icon?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-alaska-sage-lt bg-white px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-alaska-muted">{label}</p>
        {icon}
      </div>
      <p className={cn("mt-1 text-sm font-medium text-alaska-dark", tone)}>{value}</p>
    </div>
  )
}

function ExportButton({
  title,
  description,
  onClick,
}: {
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <Button variant="outline" className="h-12 w-full justify-start gap-3 border-alaska-sage-lt bg-white hover:bg-alaska-sage-lt" onClick={onClick}>
      <Download size={18} className="text-alaska-sage" />
      <div className="text-left">
        <p className="text-sm font-medium text-alaska-dark">{title}</p>
        <p className="text-xs text-alaska-muted">{description}</p>
      </div>
    </Button>
  )
}
