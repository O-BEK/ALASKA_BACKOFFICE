"use client"
import { useEffect, useState } from "react"
import { format, addDays, subDays, startOfWeek, addWeeks, subWeeks, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { useDailyEntry } from "@/lib/hooks/useDailyEntry"
import { useDashboard } from "@/lib/hooks/useDashboard"
import { useWeekView } from "@/lib/hooks/useWeekView"
import { useWeekEntries } from "@/lib/hooks/useWeekEntries"
import { useCaisseBalance } from "@/lib/hooks/useCaisseBalance"
import { useCharges } from "@/lib/hooks/useCharges"
import { useExpenseTemplates } from "@/lib/hooks/useExpenseTemplates"
import { useUserRole } from "@/lib/hooks/useUserRole"
import { getCashEnvelope, getCashMovementsReference, getCashSalesReference, getGlobalIndicativeCA, hasCashJournal } from "@/lib/cash"
import { formatMAD } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, CheckCircle2, Minus, Plus, ChevronDown, ChevronUp, Save, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { WeekGrid } from "@/components/saisie/WeekGrid"

const TABS = ["Caisse", "Semaine", "Mois"] as const
type Tab = typeof TABS[number]

const MONTHS_FR = ["Jan", "Fév", "Mars", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

export default function SaisiePage() {
  const today = new Date()
  const initialRequestedDate = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("date") : null
  const initialDate = initialRequestedDate ? parseISO(initialRequestedDate) : today
  const [tab, setTab] = useState<Tab>("Caisse")
  const [date, setDate] = useState(initialDate)
  const [weekStart, setWeekStart] = useState(startOfWeek(initialDate, { weekStartsOn: 1 }))
  const [viewMonth, setViewMonth] = useState(format(today, "yyyy-MM"))
  const [showAllStaff, setShowAllStaff] = useState(false)
  const { role } = useUserRole()
  const isAdmin = role === "admin"
  const availableTabs = isAdmin ? TABS : (TABS.filter((item) => item !== "Mois") as Tab[])
  const setActiveDate = (nextDate: Date) => {
    setDate(nextDate)
    setWeekStart(startOfWeek(nextDate, { weekStartsOn: 1 }))
  }

  useEffect(() => {
    const requestedDate = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("date") : null
    if (!requestedDate) return
    const nextDate = parseISO(requestedDate)
    setDate(nextDate)
    setWeekStart(startOfWeek(nextDate, { weekStartsOn: 1 }))
  }, [])

  useEffect(() => {
    if (!isAdmin && tab === "Mois") {
      setTab("Caisse")
    }
  }, [isAdmin, tab])

  const dateStr = format(date, "yyyy-MM-dd")
  const { entry, update, updateExpense, addExpense, save, saved, error: entryError } = useDailyEntry(dateStr)
  const { cashMonth } = useDashboard(viewMonth, isAdmin)
  const weekData = useWeekView(weekStart)
  const {
    entries: weekEntries,
    dates: weekDates,
    updateCA: updateWeekCA,
    updateExpense: updateWeekExpense,
    error: weekEntriesError,
  } = useWeekEntries(weekStart)
  const balanceSince = format(weekStart, "yyyy-MM-dd")
  const { balance, toDeposit, since, error: balanceError, refetch: refetchBalance } = useCaisseBalance(balanceSince)
  const safeExpenses = Array.isArray(entry.expenses) ? entry.expenses : []
  const safeWeekDays = Array.isArray(weekData.days) ? weekData.days : []
  const weekTotals = weekDates.reduce(
    (totals, weekDate) => {
      const weekEntry = weekEntries[weekDate]
      const expenses = weekEntry?.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0) ?? 0
      totals.cashSales += getCashSalesReference(weekEntry)
      totals.cashMovements += getCashMovementsReference(weekEntry)
      totals.expenses += expenses
      totals.envelope += getCashEnvelope(weekEntry, expenses)
      totals.caGlobal += getGlobalIndicativeCA(weekEntry)
      return totals
    },
    { cashSales: 0, cashMovements: 0, expenses: 0, envelope: 0, caGlobal: 0 }
  )

  const { charges } = useCharges("staff")
  const { sections } = useExpenseTemplates()
  const staff = charges.filter((charge) => charge.is_staff && charge.is_active)
  const visibleStaff = showAllStaff ? staff : staff.filter((staffMember) => {
    const exp = safeExpenses.find((item) => item.label === staffMember.name)
    return exp && exp.amount > 0
  })

  const getOrCreateExpense = (label: string, category: "MP" | "RH" | "CHARGES" | "AUTRE") => {
    return safeExpenses.find((expense) => expense.label === label) || { id: `${label}-${dateStr}`, category, label, amount: 0 }
  }

  const handleExpenseChange = (label: string, category: "MP" | "RH" | "CHARGES" | "AUTRE", amount: number) => {
    const existing = safeExpenses.find((expense) => expense.label === label)
    if (existing) {
      updateExpense(existing.id, Math.max(0, amount))
    } else if (amount > 0) {
      addExpense({ id: `${label}-${dateStr}-${Date.now()}`, category, label, amount })
    }
  }

  const totalExpenses = safeExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  const journalActive = hasCashJournal(entry)
  const cashSalesReference = getCashSalesReference(entry)
  const cashMovementsReference = getCashMovementsReference(entry)
  const globalIndicativeCA = getGlobalIndicativeCA(entry)
  const soldeCaisse = getCashEnvelope(entry, totalExpenses)
  const statusIcon = cashSalesReference > 0 && totalExpenses > 0 ? "✅"
    : cashSalesReference > 0 || totalExpenses > 0 ? "🟡" : "⬜"
  const handleWeekCAUpdate = async (weekDate: string, ca: number) => {
    await updateWeekCA(weekDate, ca)
    refetchBalance()
  }
  const handleWeekExpenseUpdate = async (
    weekDate: string,
    category: "MP" | "RH" | "CHARGES" | "AUTRE",
    label: string,
    amount: number
  ) => {
    await updateWeekExpense(weekDate, category, label, amount)
    refetchBalance()
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex bg-white border border-alaska-sage-lt rounded-lg p-1 gap-1">
        {availableTabs.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={cn(
              "flex-1 py-2 rounded-md text-sm font-medium transition",
              tab === item ? "bg-alaska-sage text-white" : "text-alaska-muted hover:bg-alaska-sage-lt"
            )}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Caisse" && (entryError || balanceError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {entryError || balanceError}
        </div>
      )}

      {tab === "Semaine" && weekEntriesError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {weekEntriesError}
        </div>
      )}

      {tab === "Caisse" && (
        <div className="space-y-4">
          <Card className="bg-alaska-dark text-white rounded-xl">
            <CardContent className="pt-4 pb-4 space-y-2">
              <p className="text-[11px] text-alaska-muted uppercase tracking-wide mb-1">Enveloppe cash cumulée</p>
              <div className="flex justify-between items-center">
                <span className="text-sm text-alaska-muted">Cash théorique enveloppe</span>
                <span className="font-playfair font-bold text-lg text-white">{formatMAD(balance)}</span>
              </div>
              <div className="border-t border-white/20 pt-2 flex justify-between items-center">
                <span className="text-sm text-alaska-muted">À déposer</span>
                <span className={cn("font-playfair font-bold text-lg", toDeposit > 0 ? "text-alaska-gold" : "text-alaska-muted")}>
                  {formatMAD(toDeposit)}
                </span>
              </div>
              <p className="text-[10px] text-alaska-muted text-right">{since ? `Depuis lun. ${since.slice(8, 10)}/${since.slice(5, 7)} · ` : ""}Réserve 1 000 MAD</p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <button onClick={() => setActiveDate(subDays(date, 1))} className="p-2 hover:bg-alaska-sage-lt rounded-lg transition">
                  <ChevronLeft size={20} className="text-alaska-muted" />
                </button>
                <div className="text-center">
                  <p className="font-semibold text-alaska-dark capitalize">{format(date, "EEEE d MMMM yyyy", { locale: fr })}</p>
                  <p className="text-lg mt-0.5">{statusIcon}</p>
                </div>
                <button onClick={() => setActiveDate(addDays(date, 1))} className="p-2 hover:bg-alaska-sage-lt rounded-lg transition">
                  <ChevronRight size={20} className="text-alaska-muted" />
                </button>
              </div>
              <button onClick={() => setActiveDate(today)} className="w-full mt-2 text-xs text-alaska-sage hover:underline">Aujourd&apos;hui</button>
            </CardContent>
          </Card>

          <Card className="bg-white border-l-4 border-alaska-sage border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-base flex items-center gap-2 text-alaska-dark flex-wrap">
                <span>💵 Caisse / Enveloppe</span>
                {entry.source === "csv_import" && (
                  <span className="text-xs bg-alaska-sage-lt text-alaska-sage px-2 py-0.5 rounded-full font-normal">Ventes CSV</span>
                )}
                {journalActive && (
                  <span className="text-xs bg-alaska-gold/20 text-alaska-dark px-2 py-0.5 rounded-full font-normal">Journal POS</span>
                )}
                {entry.cash_journal_anomaly && (
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-normal">Alerte contrôle</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ReadonlyMoneyCard label="CA cash POS" value={cashSalesReference} hint={journalActive ? "Source principale: journal POS" : "Fallback: CSV ventes"} />
                <ReadonlyMoneyCard
                  label="Mouvements de caisse POS"
                  value={cashMovementsReference}
                  hint={journalActive ? "Import journal POS" : "Fallback legacy"}
                  tone={cashMovementsReference < 0 ? "warning" : "default"}
                />
                <ReadonlyMoneyCard label="CA global indicatif" value={globalIndicativeCA} hint="Cash + CB" />
                <ReadonlyMoneyCard
                  label="Fond constaté POS"
                  value={entry.cash_closing_fund ?? 0}
                  hint={entry.cash_closing_fund === null ? "Non remonté par le journal" : `Sessions consolidées: ${entry.cash_journal_sessions || 1}`}
                  mutedWhenZero={entry.cash_closing_fund === null}
                />
              </div>

              <div className="rounded-lg border border-alaska-sage-lt bg-alaska-sage-lt/20 p-3 text-sm text-alaska-muted space-y-1">
                <div className="flex justify-between gap-3">
                  <span>Fond ouverture POS</span>
                  <span className="font-medium text-alaska-dark">{entry.cash_opening_fund === null ? "—" : formatMAD(entry.cash_opening_fund)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Fond constaté POS</span>
                  <span className="font-medium text-alaska-dark">{entry.cash_closing_fund === null ? "—" : formatMAD(entry.cash_closing_fund)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Sessions consolidées</span>
                  <span className="font-medium text-alaska-dark">{entry.cash_journal_sessions || 0}</span>
                </div>
              </div>

              <Input
                placeholder="Notes (écart, explication, contexte du jour...)"
                value={entry.notes}
                onChange={(event) => update({ notes: event.target.value })}
                className="text-sm focus:ring-alaska-sage focus:border-alaska-sage"
              />
            </CardContent>
          </Card>

          {sections.map((section) => (
            <ExpenseGroup key={section.id} title={`${section.emoji} ${section.name} cash`} defaultOpen={section.expense_category === "MP"}>
              {section.items.map((item) => {
                const expense = getOrCreateExpense(item.label, section.expense_category)
                return (
                  <ExpenseRow
                    key={item.id}
                    label={item.label}
                    value={expense.amount}
                    onChange={(value) => handleExpenseChange(item.label, section.expense_category, value)}
                  />
                )
              })}
            </ExpenseGroup>
          ))}

          <ExpenseGroup title="👥 Paiements cash personnel">
            <div className="space-y-2">
              {visibleStaff.map((staffMember) => {
                const expense = getOrCreateExpense(staffMember.name, "RH")
                return (
                  <ExpenseRow
                    key={staffMember.id}
                    label={`${staffMember.name}${staffMember.payment_day ? ` (j.${staffMember.payment_day})` : ""}`}
                    value={expense.amount}
                    onChange={(value) => handleExpenseChange(staffMember.name, "RH", value)}
                  />
                )
              })}
              <button onClick={() => setShowAllStaff((current) => !current)} className="w-full text-xs text-alaska-sage hover:underline pt-1">
                {showAllStaff ? "Masquer" : `Afficher tout le personnel (${staff.length})`}
              </button>
            </div>
          </ExpenseGroup>

          <Card className="bg-alaska-dark text-white rounded-xl">
            <CardContent className="pt-4 pb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-alaska-muted">CA cash POS</span>
                <span className="font-semibold">{formatMAD(cashSalesReference)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-alaska-muted">Mouvements de caisse POS</span>
                <span className={cn("font-semibold", cashMovementsReference >= 0 ? "text-alaska-gold" : "text-orange-300")}>
                  {cashMovementsReference >= 0 ? "+" : "-"}{formatMAD(Math.abs(cashMovementsReference))}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-alaska-muted">Achats cash du jour</span>
                <span className="font-semibold text-orange-300">-{formatMAD(totalExpenses)}</span>
              </div>
              <div className="border-t border-white/20 pt-2 flex justify-between font-bold text-base">
                <span>💵 Cash théorique enveloppe</span>
                <span className={cn("font-playfair text-lg", soldeCaisse >= 0 ? "text-alaska-gold" : "text-red-400")}>
                  {soldeCaisse < 0 ? "-" : ""}{formatMAD(Math.abs(soldeCaisse))}
                  {soldeCaisse < 0 && " ⚠"}
                </span>
              </div>
              <Button
                onClick={async () => {
                  await save()
                  refetchBalance()
                }}
                className="w-full mt-3 bg-white text-alaska-dark hover:bg-alaska-sage-lt font-semibold"
              >
                {saved ? <><CheckCircle2 size={16} className="mr-2" />Enregistré</> : <><Save size={16} className="mr-2" />Enregistrer</>}
              </Button>
              {!saved && <p className="text-center text-xs text-alaska-muted flex items-center justify-center gap-1"><Clock size={10} />Sauvegarde auto dans 2s</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "Semaine" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-alaska-sage-lt rounded-lg p-3">
            <button onClick={() => setWeekStart((current) => subWeeks(current, 1))} className="p-1 hover:bg-alaska-sage-lt rounded transition">
              <ChevronLeft size={18} className="text-alaska-muted" />
            </button>
            <p className="text-sm font-semibold text-alaska-dark">
              {format(weekStart, "d MMM", { locale: fr })} – {format(addDays(weekStart, 6), "d MMM yyyy", { locale: fr })}
            </p>
            <button onClick={() => setWeekStart((current) => addWeeks(current, 1))} className="p-1 hover:bg-alaska-sage-lt rounded transition">
              <ChevronRight size={18} className="text-alaska-muted" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="bg-alaska-dark text-white rounded-xl">
              <CardContent className="pt-4 pb-4">
                <p className="text-[11px] text-alaska-muted uppercase tracking-wide">Cash théorique enveloppe</p>
                <p className={cn("text-2xl font-playfair font-bold mt-1", weekTotals.envelope >= 0 ? "text-alaska-gold" : "text-red-400")}>
                  {weekTotals.envelope < 0 ? "-" : ""}{formatMAD(Math.abs(weekTotals.envelope))}
                </p>
                <p className="text-xs text-alaska-muted mt-1">Cash POS + mouvements - achats cash</p>
              </CardContent>
            </Card>
            <Card className="bg-white border border-alaska-sage-lt rounded-xl">
              <CardContent className="pt-4 pb-4">
                <p className="text-[11px] text-alaska-muted uppercase tracking-wide">Cash POS semaine</p>
                <p className="text-2xl font-playfair font-bold text-alaska-dark mt-1">{formatMAD(weekTotals.cashSales)}</p>
                <p className="text-xs text-alaska-muted mt-1">Achats: {formatMAD(weekTotals.expenses)} · Mouvements: {formatMAD(weekTotals.cashMovements)}</p>
              </CardContent>
            </Card>
          </div>
          <div className="hidden md:block bg-white border border-alaska-sage-lt rounded-xl p-4">
            <WeekGrid entries={weekEntries} dates={weekDates} onUpdateCA={handleWeekCAUpdate} onUpdateExpense={handleWeekExpenseUpdate} />
          </div>
          <div className="md:hidden space-y-4">
            <Card className="bg-white border border-alaska-sage-lt rounded-xl">
              <CardContent className="pt-4 pb-2 space-y-2">
                {safeWeekDays.map((day) => (
                  <button
                    key={day.date}
                    onClick={() => {
                      setActiveDate(new Date(day.date))
                      setTab("Caisse")
                    }}
                    className="w-full flex items-center justify-between p-3 bg-alaska-sage-lt/40 hover:bg-alaska-sage-lt rounded-lg transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{day.status === "full" ? "✅" : day.status === "partial" ? "🟡" : "⬜"}</span>
                      <span className="text-sm font-medium capitalize text-alaska-dark">{day.label}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-alaska-dark">{day.entry ? formatMAD(getCashSalesReference(day.entry)) : "—"}</p>
                      {day.totalExpenses > 0 && <p className="text-xs text-alaska-muted">Achats: {formatMAD(day.totalExpenses)}</p>}
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
            <button
              onClick={() => {
                const [year, month] = viewMonth.split("-").map(Number)
                setViewMonth(month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`)
              }}
              className="p-1 hover:bg-alaska-sage-lt rounded"
            >
              <ChevronLeft size={18} className="text-alaska-muted" />
            </button>
            <p className="text-sm font-semibold text-alaska-dark">
              {`${MONTHS_FR[parseInt(viewMonth.split("-")[1]) - 1]} ${viewMonth.split("-")[0]}`}
            </p>
            <button
              onClick={() => {
                const [year, month] = viewMonth.split("-").map(Number)
                setViewMonth(month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`)
              }}
              className="p-1 hover:bg-alaska-sage-lt rounded"
            >
              <ChevronRight size={18} className="text-alaska-muted" />
            </button>
          </div>
          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-alaska-muted">Cash POS mensuel</span>
                <span className="font-playfair font-bold text-alaska-dark">{formatMAD(cashMonth.cash_sales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-alaska-muted">Mouvements POS</span>
                <span className="font-playfair font-bold text-alaska-dark">{formatMAD(cashMonth.cash_movements)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-alaska-muted">Achats cash</span>
                <span className="font-playfair font-bold text-orange-600">{formatMAD(cashMonth.cash_purchases)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-alaska-muted">Cash théorique enveloppe</span>
                <span className="font-playfair font-bold text-alaska-dark">{formatMAD(cashMonth.cash_envelope)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-alaska-muted">CA global indicatif</span>
                <span className="font-playfair font-bold text-alaska-dark">{formatMAD(cashMonth.ca_global)}</span>
              </div>
              <p className="text-xs text-alaska-muted text-center pt-2">
                {cashMonth.anomaly_days > 0 ? `${cashMonth.anomaly_days} journée(s) en alerte contrôle sur le mois` : "Vue mensuelle cash consolidée"}
              </p>
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
      <button onClick={() => setOpen((current) => !current)} className="w-full flex items-center justify-between p-4 text-left">
        <span className="font-semibold text-alaska-dark text-sm">{title}</span>
        {open ? <ChevronUp size={18} className="text-alaska-muted" /> : <ChevronDown size={18} className="text-alaska-muted" />}
      </button>
      {open && <CardContent className="pt-0 pb-4 space-y-2">{children}</CardContent>}
    </Card>
  )
}

function ExpenseRow({ label, value, onChange }: { label: string; value: number; onChange: (_value: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-alaska-muted flex-1 min-w-0 truncate">{label}</span>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onChange(Math.max(0, value - 100))} className="w-7 h-7 flex items-center justify-center border border-alaska-sage-lt rounded-md hover:bg-alaska-sage-lt">
          <Minus size={12} className="text-alaska-muted" />
        </button>
        <input
          type="number"
          value={value || ""}
          placeholder="0"
          onChange={(event) => onChange(parseFloat(event.target.value) || 0)}
          className="w-24 h-8 text-right text-sm border border-alaska-sage-lt rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-alaska-sage focus:border-alaska-sage"
        />
        <button onClick={() => onChange(value + 100)} className="w-7 h-7 flex items-center justify-center border border-alaska-sage-lt rounded-md hover:bg-alaska-sage-lt">
          <Plus size={12} className="text-alaska-muted" />
        </button>
      </div>
    </div>
  )
}

function ReadonlyMoneyCard({
  label,
  value,
  hint,
  tone = "default",
  mutedWhenZero = false,
}: {
  label: string
  value: number
  hint?: string
  tone?: "default" | "warning"
  mutedWhenZero?: boolean
}) {
  const toneClass = tone === "warning" ? "text-orange-600" : "text-alaska-dark"
  const isMuted = mutedWhenZero && value === 0

  return (
    <div className="rounded-lg border border-alaska-sage-lt p-3 bg-white">
      <p className="text-xs text-alaska-muted">{label}</p>
      <p className={cn("text-lg font-playfair font-bold", isMuted ? "text-alaska-muted" : toneClass)}>{isMuted ? "—" : formatMAD(value)}</p>
      {hint && <p className="text-[11px] text-alaska-muted mt-1">{hint}</p>}
    </div>
  )
}
