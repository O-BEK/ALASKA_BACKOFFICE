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
import { getCashEnvelope, getCashMovementsReference, getCashSalesReference, getGlobalIndicativeCA } from "@/lib/cash"

export default function SemainePage() {
  const router = useRouter()
  const [weekStart, setWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )

  const weekData = useWeekView(weekStart)
  const { entries, dates, updateCA, updateExpense } = useWeekEntries(weekStart)
  const safeDays = Array.isArray(weekData.days) ? weekData.days : []
  const weekTotals = dates.reduce(
    (totals, date) => {
      const entry = entries[date]
      const expenses = entry?.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0) ?? 0
      totals.cashSales += getCashSalesReference(entry)
      totals.cashMovements += getCashMovementsReference(entry)
      totals.expenses += expenses
      totals.envelope += getCashEnvelope(entry, expenses)
      totals.caGlobal += getGlobalIndicativeCA(entry)
      entry?.expenses.forEach((expense) => {
        totals.expensesByLabel[expense.label] = (totals.expensesByLabel[expense.label] || 0) + Number(expense.amount || 0)
      })
      return totals
    },
    { cashSales: 0, cashMovements: 0, expenses: 0, envelope: 0, caGlobal: 0, expensesByLabel: {} as Record<string, number> }
  )
  const safeExpensesByLabel = Object.entries(weekTotals.expensesByLabel)
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount)

  const weeklyBreakeven = getWeeklyBreakeven()
  const pctSeuil = weeklyBreakeven > 0 ? (weekTotals.caGlobal / weeklyBreakeven) * 100 : 0
  const weekLabel = `${format(weekStart, "d MMM", { locale: fr })} – ${format(addDays(weekStart, 6), "d MMM yyyy", { locale: fr })}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Semaine</h1>
          <p className="text-alaska-muted text-sm mt-0.5">Vue hebdomadaire</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-alaska-sage-lt rounded-lg p-1 self-center sm:self-auto">
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
        <Card className="bg-alaska-dark text-white rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-[11px] text-alaska-muted uppercase tracking-wide">Cash théorique enveloppe</p>
            <p className={cn("text-xl font-playfair font-bold mt-1",
              weekTotals.envelope >= 0 ? "text-alaska-gold" : "text-red-400")}>
              {weekTotals.envelope < 0 ? "-" : ""}{formatMAD(Math.abs(weekTotals.envelope))}
            </p>
            <p className="text-[10px] text-alaska-muted mt-1">Cash POS + mouvements - achats</p>
          </CardContent>
        </Card>
        <Card className="bg-white border border-alaska-sage-lt rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-[11px] text-alaska-muted uppercase tracking-wide">Cash POS semaine</p>
            <p className="text-xl font-playfair font-bold text-alaska-dark mt-1">{formatMAD(weekTotals.cashSales)}</p>
            <p className="text-[10px] text-alaska-muted mt-1">CA global : {formatMAD(weekTotals.caGlobal)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border border-alaska-sage-lt rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-[11px] text-alaska-muted uppercase tracking-wide">Achats cash</p>
            <p className="text-xl font-playfair font-bold text-orange-600 mt-1">{formatMAD(weekTotals.expenses)}</p>
            <p className="text-[10px] text-alaska-muted mt-1">Mouvements : {formatMAD(weekTotals.cashMovements)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border border-alaska-sage-lt rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-[11px] text-alaska-muted uppercase tracking-wide">Seuil semaine</p>
            <p className={cn(
              "text-2xl font-playfair font-bold mt-1",
              pctSeuil >= 100 ? "text-alaska-sage" : pctSeuil >= 70 ? "text-amber-500" : "text-red-500"
            )}>
              {pctSeuil.toFixed(0)}%
            </p>
            <p className="text-xs text-alaska-muted mt-1">
              {formatMAD(weekTotals.caGlobal)} / {formatMAD(weeklyBreakeven)}
            </p>
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
                {safeDays.map(day => (
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
                    {day.entry ? formatMAD(getCashSalesReference(day.entry)) : "—"}
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
      {safeExpensesByLabel.length > 0 && (
        <Card className="bg-white border border-alaska-sage-lt rounded-xl">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-base text-alaska-dark">Dépenses par poste — cette semaine</CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <ExpenseBar items={safeExpensesByLabel} maxItems={6}/>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
