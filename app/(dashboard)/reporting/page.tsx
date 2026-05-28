"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"
import { parseReportingPayload } from "@/lib/contracts"
import { cn, formatMAD, formatPct } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Banknote, ChevronLeft, ChevronRight, Database, Download, FileText, Scale, TrendingUp, Users } from "lucide-react"
import { FoodCostAlert } from "@/components/ui/FoodCostAlert"
import { Area, AreaChart, Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useCalendarEvents } from "@/lib/hooks/useCalendarEvents"
import { getAnnotationsForPeriod, isN1ComparisonValid } from "@/lib/calendar-context"
import { CalendarAnnotationBadge } from "@/components/calendar/CalendarAnnotation"
import { startOfMonth, endOfMonth, subMonths } from "date-fns"

const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
const PIE_COLORS = ["#4a6741", "#c9a96e", "#e6a830", "#7a7a6a"]
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

function signedMAD(value: number) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : ""
  return `${prefix}${formatMAD(Math.abs(value))}`
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
  const projection = payload.projection
  const dataQuality = payload.dataQuality
  const cashFlow = payload.cashFlow
  const financial = payload.financialConsolidation
  const performanceDays = payload.performanceDays
  const bestDays = performanceDays.slice(0, 5)
  const slowDays = [...performanceDays].filter((item) => item.ca_total > 0).sort((a, b) => a.ca_total - b.ca_total).slice(0, 3)
  const hasSalesMix = payload.salesMix.some((item) => item.value > 0)
  const hasReportData = summary.ca_total > 0 || summary.total_expenses > 0 || dataQuality.sales_days > 0
  const projectionStatus = projection.projected_gap >= 0 ? "Rythme suffisant" : "Rythme à renforcer"

  const { events: calendarEvents } = useCalendarEvents(month)

  const calendarContext = useMemo(() => {
    if (!month || !calendarEvents.length) return { annotations: [], n1Note: null }
    const [y, m] = month.split("-").map(Number)
    const start = startOfMonth(new Date(y, m - 1, 1))
    const end = endOfMonth(start)
    const n1Date = subMonths(start, 12)
    const annotations = getAnnotationsForPeriod(start, end, calendarEvents, payload.summary?.ca_total ?? 0)
    const n1Check = isN1ComparisonValid(
      { start, end },
      { start: startOfMonth(n1Date), end: endOfMonth(n1Date) },
      calendarEvents
    )
    return { annotations, n1Note: n1Check.valid ? null : n1Check.note ?? null }
  }, [month, calendarEvents, payload.summary?.ca_total])

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Pilotage</h1>
          <p className="mt-1 text-sm text-alaska-muted">Vue mensuelle de pilotage et exports rapides</p>
        </div>
        <div className="flex items-center gap-2 self-center rounded-lg border border-alaska-sage-lt bg-white p-1 lg:self-auto">
          <button onClick={() => setMonth(moveMonth(month, -1))} className="rounded-md p-1.5 transition hover:bg-alaska-sage-lt" aria-label="Mois précédent">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span className="min-w-[160px] px-2 text-center text-sm font-semibold text-alaska-dark">{heading}</span>
          <button onClick={() => setMonth(moveMonth(month, 1))} className="rounded-md p-1.5 transition hover:bg-alaska-sage-lt" aria-label="Mois suivant">
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !hasReportData && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Aucune donnée consolidée pour {heading}. Les cartes restent à zéro tant que les ventes POS ou les achats cash ne sont pas importés.
        </div>
      )}

      {(calendarContext.annotations.length > 0 || calendarContext.n1Note) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <span>📅</span> Contexte calendaire
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {calendarContext.annotations.map((annotation, i) => (
              <CalendarAnnotationBadge key={i} annotation={annotation} />
            ))}
            {calendarContext.n1Note && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
                ⚠️ {calendarContext.n1Note}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ReportingKpiCard
          title="CA total"
          value={formatMAD(summary.ca_total)}
          sub={`${formatPct(summary.prev_pct)} vs mois précédent`}
          subColor={summary.prev_pct >= 0 ? "text-alaska-sage" : "text-red-500"}
        />
        <ReportingKpiCard
          title="Résultat réel"
          value={financial.has_data ? formatMAD(financial.real_result) : "—"}
          valueClass={!financial.has_data ? "text-alaska-muted" : financial.real_result >= 0 ? "text-alaska-sage" : "text-red-600"}
          sub={financial.has_data ? `${financial.confirmed_count} tx banque confirmée(s)` : "Banque à consolider"}
          subColor={financial.pending_review_count > 0 ? "text-amber-700" : undefined}
        />
        <ReportingKpiCard
          title="Projection"
          value={formatMAD(projection.projected_ca)}
          valueClass={projection.projected_gap >= 0 ? "text-alaska-sage" : "text-amber-600"}
          sub={`${signedMAD(projection.projected_gap)} vs ${projection.reference_type === "objective" ? "objectif" : "seuil"}`}
          subColor={projection.projected_gap >= 0 ? "text-alaska-sage" : "text-red-500"}
        />
        <ReportingKpiCard
          title="Ticket moyen"
          value={formatMAD(summary.avg_ticket)}
          sub={`${summary.tickets_count} ticket(s) importé(s)`}
        />
        <ReportingKpiCard
          title="Couverture"
          value={`${dataQuality.coverage_pct.toFixed(0)}%`}
          sub={`${dataQuality.sales_days}/${dataQuality.month_days} jours ventes`}
          gauge={dataQuality.coverage_pct}
          valueClass={dataQuality.coverage_pct >= 80 ? "text-alaska-sage" : dataQuality.coverage_pct >= 50 ? "text-amber-600" : "text-red-600"}
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
                  <MetricBox label="Ticket moyen" value={formatMAD(summary.avg_ticket)} />
                  <MetricBox label="Cash suivi" value={`${formatMAD(cashFlow.cash_sales)} · ${cashFlow.cash_ratio.toFixed(0)}%`} tone="text-alaska-dark" />
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-alaska-dark">Projection & rythme</CardTitle>
                  <CardDescription className="text-xs text-alaska-muted">Lecture fin de mois à partir du rythme actuel</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-alaska-sage-lt bg-alaska-sage-lt/30 px-4 py-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-alaska-muted">Projection</p>
                      <p className="mt-1 font-playfair text-2xl font-bold text-alaska-dark">{formatMAD(projection.projected_ca)}</p>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", projection.projected_gap >= 0 ? "bg-alaska-sage-lt text-alaska-sage" : "bg-amber-100 text-amber-700")}>
                      {projectionStatus}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MetricBox label="Cible suivie" value={formatMAD(projection.reference_value)} />
                    <MetricBox label="Écart projeté" value={signedMAD(projection.projected_gap)} tone={projection.projected_gap >= 0 ? "text-alaska-sage" : "text-red-600"} />
                    <MetricBox label="CA / jour restant" value={projection.required_daily > 0 ? formatMAD(projection.required_daily) : "Cible couverte"} />
                  </div>
                  <p className="text-xs text-alaska-muted">
                    La cible suivie est {projection.reference_type === "objective" ? "l'objectif mensuel" : "le seuil de rentabilité"}.
                  </p>
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
                    <CardTitle className="text-base text-alaska-dark">Jours forts du mois</CardTitle>
                    <CardDescription className="text-xs text-alaska-muted">Les journées qui tirent le CA</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {bestDays.length > 0 ? (
                      <div className="space-y-2">
                        {bestDays.map((item) => (
                          <div key={item.date} className="rounded-lg border border-alaska-sage-lt bg-alaska-sage-lt/30 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-alaska-dark">{item.date}</p>
                              <p className="text-sm font-semibold text-alaska-dark">{formatMAD(item.ca_total)}</p>
                            </div>
                            <p className="mt-1 text-xs text-alaska-muted">
                              {item.tickets_count} ticket(s) · ticket moyen {formatMAD(item.avg_ticket)} · soir {formatMAD(item.ca_soir)}
                              {item.anomaly ? " · anomalie journal" : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-8 text-center text-sm text-alaska-muted">Aucune vente importée sur ce mois.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-alaska-dark">Jours à surveiller</CardTitle>
                    <CardDescription className="text-xs text-alaska-muted">Bas de mois et points de contrôle</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {slowDays.length > 0 ? (
                      <div className="space-y-2">
                        {slowDays.map((item) => (
                          <div key={item.date} className="rounded-lg border border-alaska-sage-lt bg-white px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-alaska-dark">{item.date}</p>
                              <p className="text-sm font-semibold text-alaska-dark">{formatMAD(item.ca_total)}</p>
                            </div>
                            <p className="mt-1 text-xs text-alaska-muted">
                              {item.tickets_count} ticket(s) · ticket moyen {formatMAD(item.avg_ticket)}
                              {item.has_journal ? " · journal consolidé" : " · journal à consolider"}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-8 text-center text-sm text-alaska-muted">Aucun jour faible à afficher pour cette période.</p>
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
                  <ExportButton title="CSV ventes & cash" description={`CA, cash suivi, achats cash — ${heading}`} onClick={() => exportFile(month, "monthly")} />
                  <ExportButton title="CSV achats cash saisis" description={`Sorties cash opérationnelles — ${heading}`} onClick={() => exportFile(month, "expenses")} />
                  <ExportButton title="CSV comparaison CA" description={`Comparaison ${year} vs ${year - 1}`} onClick={() => exportFile(month, "comparison")} />
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-alaska-dark">Mix d&apos;encaissement</CardTitle>
                  <CardDescription className="text-xs text-alaska-muted">Caisse vs B2B sur le mois</CardDescription>
                </CardHeader>
                <CardContent>
                  {hasSalesMix ? (
                    <div className="flex flex-col items-center gap-6">
                      <ResponsiveContainer width="100%" height={190}>
                        <PieChart>
                          <Pie data={payload.salesMix} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={3}>
                            {payload.salesMix.map((_, index) => (
                              <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatMAD(value)} contentStyle={{ borderRadius: "8px", border: "1px solid #e8ede7", fontSize: "12px" }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="w-full space-y-2">
                        {payload.salesMix.map((item, index) => (
                          <div key={item.name} className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                            <span className="flex-1 text-sm text-alaska-dark">{item.name}</span>
                            <span className="text-sm font-medium text-alaska-dark">{formatMAD(item.value)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="grid w-full grid-cols-2 gap-3">
                        <MetricBox label="CA soir" value={`${formatMAD(summary.ca_soir)} · ${summary.pct_soir.toFixed(0)}%`} />
                        <MetricBox label="Cash suivi" value={`${cashFlow.cash_ratio.toFixed(0)}% du CA`} />
                      </div>
                    </div>
                  ) : (
                    <p className="py-8 text-center text-sm text-alaska-muted">Aucune vente importée pour ce mois.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-alaska-dark">Flux cash suivi</CardTitle>
                  <CardDescription className="text-xs text-alaska-muted">Uniquement les flux présents dans la caisse</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <MetricBox label="Ventes cash POS" value={formatMAD(cashFlow.cash_sales)} icon={<Banknote size={16} className="text-alaska-sage" />} />
                  <MetricBox label="Mouvements caisse" value={signedMAD(cashFlow.cash_movements)} tone={cashFlow.cash_movements >= 0 ? "text-alaska-sage" : "text-red-600"} />
                  <MetricBox label="Achats cash saisis" value={formatMAD(cashFlow.cash_purchases)} tone="text-orange-600" />
                  <MetricBox label="Enveloppe cash estimée" value={formatMAD(cashFlow.cash_envelope)} tone={cashFlow.cash_envelope >= 0 ? "text-alaska-dark" : "text-red-600"} />
                  {cashFlow.anomaly_days > 0 && (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <AlertTriangle size={14} />
                      {cashFlow.anomaly_days} jour(s) avec anomalie journal de caisse.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-alaska-dark">Banque + Cash - résultat réel</CardTitle>
                  <CardDescription className="text-xs text-alaska-muted">Vue encaissée: POS + revenus confirmés - dépenses cash et banque</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <MetricBox
                    label="Résultat réel du mois"
                    value={financial.has_data ? formatMAD(financial.real_result) : "Banque non consolidée"}
                    tone={!financial.has_data ? "text-alaska-muted" : financial.real_result >= 0 ? "text-alaska-sage" : "text-red-600"}
                    icon={<Scale size={16} className={financial.real_result >= 0 ? "text-alaska-sage" : "text-red-500"} />}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricBox label="CA POS" value={formatMAD(financial.ca_pos)} />
                    <MetricBox label="Revenus hors POS" value={formatMAD(financial.external_income)} tone="text-alaska-sage" />
                    <MetricBox label="Dépenses cash" value={formatMAD(financial.cash_expenses)} tone="text-orange-600" />
                    <MetricBox label="Dépenses banque" value={formatMAD(financial.bank_expenses)} tone="text-orange-600" />
                    <MetricBox label="Flux net banque" value={signedMAD(financial.bank_net)} tone={financial.bank_net >= 0 ? "text-alaska-sage" : "text-red-600"} />
                    <MetricBox label="Apports à vérifier" value={formatMAD(financial.owner_injections)} tone={financial.owner_injections > 0 ? "text-amber-700" : "text-alaska-muted"} />
                  </div>
                  <div className="rounded-lg border border-alaska-sage-lt bg-alaska-sage-lt/30 px-3 py-2 text-xs text-alaska-muted">
                    Dépôts cash neutres: {formatMAD(financial.cash_deposits)} sortis de caisse et {formatMAD(financial.bank_cash_deposits)} crédités en banque.
                  </div>
                  {financial.pending_review_count > 0 && (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <AlertTriangle size={14} aria-hidden="true" />
                      {financial.pending_review_count} transaction(s) bancaire(s) restent à revoir avant décision finale.
                    </div>
                  )}
                  {financial.alert && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                      <AlertTriangle size={14} aria-hidden="true" />
                      {financial.alert}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-alaska-dark">Qualité consolidation</CardTitle>
                  <CardDescription className="text-xs text-alaska-muted">Couverture ventes et journal caisse</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <MetricBox label="Jours ventes" value={`${dataQuality.sales_days}/${dataQuality.month_days}`} icon={<Database size={16} className="text-alaska-sage" />} />
                  <MetricBox label="Jours import POS" value={`${dataQuality.imported_sales_days} importés · ${dataQuality.manual_sales_days} manuels`} />
                  <MetricBox label="Journal caisse" value={`${dataQuality.journal_days}/${dataQuality.sales_days || 0} jours · ${dataQuality.journal_coverage_pct.toFixed(0)}%`} />
                  <MetricBox label="Jours manquants" value={`${dataQuality.missing_days}`} tone={dataQuality.missing_days > 0 ? "text-amber-700" : "text-alaska-sage"} />
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-alaska-dark">Pilotage restauration</CardTitle>
                  <CardDescription className="text-xs text-alaska-muted">Prime cost et résultat net estimé</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase tracking-wide text-alaska-muted">Prime cost</span>
                      <span className={cn(
                        "text-sm font-bold",
                        payload.primeCost === 0 ? "text-alaska-muted" :
                        payload.primeCost < 60 ? "text-green-600" :
                        payload.primeCost <= 65 ? "text-orange-500" : "text-red-600"
                      )}>
                        {payload.primeCost > 0 ? `${payload.primeCost.toFixed(1)} %` : "—"}
                      </span>
                    </div>
                    {payload.primeCost > 0 && (
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={cn(
                            "h-2 rounded-full transition-all",
                            payload.primeCost < 60 ? "bg-green-500" :
                            payload.primeCost <= 65 ? "bg-orange-400" : "bg-red-500"
                          )}
                          style={{ width: `${Math.min(payload.primeCost, 100)}%` }}
                        />
                      </div>
                    )}
                    <p className="text-[11px] text-alaska-muted">Norme restauration : &lt; 65 %</p>
                  </div>
                  <div className="flex justify-between items-start pt-1">
                    <span className="text-xs uppercase tracking-wide text-alaska-muted">Coût matière</span>
                    <FoodCostAlert pct={payload.foodCostPct} className="items-end" />
                  </div>
                  <div className="border-t border-alaska-sage-lt pt-3 flex justify-between items-center">
                    <span className="text-xs uppercase tracking-wide text-alaska-muted">Résultat net estimé</span>
                    <span className={cn(
                      "font-playfair font-bold text-lg",
                      payload.primeCost === 0 ? "text-alaska-muted" :
                      payload.resultatNet >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {payload.primeCost === 0 ? "—" : formatMAD(payload.resultatNet)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="rounded-xl border border-alaska-sage-lt bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-alaska-dark">CA semaine — {year} vs {year - 1}</CardTitle>
              <CardDescription className="text-xs text-alaska-muted">4 dernières semaines comparées à la même période N-1</CardDescription>
            </CardHeader>
            <CardContent>
              {payload.weekComparison.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={payload.weekComparison} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7a7a6a" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#7a7a6a" }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value: number) => formatMAD(value)} contentStyle={{ borderRadius: "8px", border: "1px solid #e8ede7", fontSize: "12px" }} />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="current" name={String(year)} fill="#4A7C6F" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="previous" name={String(year - 1)} fill="#D1D5DB" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-alaska-muted">Aucune donnée hebdomadaire disponible.</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-alaska-sage-lt bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-alaska-dark">Comparaison {year} vs {year - 1}</CardTitle>
              <CardDescription className="text-xs text-alaska-muted">Lecture mois par mois de l&apos;année courante</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
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
              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {payload.comparison.map((item) => (
                  <div key={item.month} className="flex items-center justify-between rounded-lg border border-alaska-sage-lt px-3 py-2">
                    <span className="text-sm font-medium text-alaska-dark">{item.month}</span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-alaska-muted">{formatMAD(item.previous)}</span>
                      <span className="text-alaska-dark">{formatMAD(item.current)}</span>
                      <span className={cn("font-medium", item.delta_pct === null ? "text-alaska-muted" : item.delta_pct >= 0 ? "text-alaska-sage" : "text-red-500")}>
                        {item.delta_pct === null ? "—" : formatPct(item.delta_pct)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {performanceDays.length === 0 && (
            <Card className="rounded-xl border border-dashed border-alaska-sage bg-white">
              <CardContent className="py-8 text-center">
                <p className="font-medium text-alaska-dark">Aucune vente consolidée sur cette période</p>
                <p className="mt-1 text-sm text-alaska-muted">Le rapport devient utile dès que les ventes POS ou le journal caisse sont importés.</p>
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
