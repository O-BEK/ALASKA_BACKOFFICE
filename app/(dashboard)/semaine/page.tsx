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
    startOfWeek(new Date(), { weekStartsOn: 1 })
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
                  <button key={day.date} onClick={() => router.push(`/saisie?date=${day.date}`)}
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
