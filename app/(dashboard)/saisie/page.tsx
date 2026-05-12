"use client"
import { useEffect, useState } from "react"
import { format, addDays, subDays, startOfWeek, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import Link from "next/link"
import { useDailyEntry } from "@/lib/hooks/useDailyEntry"
import { useDashboard } from "@/lib/hooks/useDashboard"
import { useCaisseBalance } from "@/lib/hooks/useCaisseBalance"
import { useCharges } from "@/lib/hooks/useCharges"
import { useExpenseTemplates } from "@/lib/hooks/useExpenseTemplates"
import { useUserRole } from "@/lib/hooks/useUserRole"
import { useMonthlySuppliers, MONTHLY_SUPPLIERS } from "@/lib/hooks/useMonthlySuppliers"
import { getCashEnvelope, getCashMovementsReference, getCashSalesReference, getGlobalIndicativeCA, hasCashJournal } from "@/lib/cash"
import { formatMAD } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, CheckCircle2, Minus, Plus, ChevronDown, ChevronUp, Save, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { FoodCostAlert } from "@/components/ui/FoodCostAlert"

const TABS = ["Caisse", "Mois"] as const
type Tab = typeof TABS[number]

const MONTHS_FR = ["Jan", "Fév", "Mars", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

export default function SaisiePage() {
  const today = new Date()
  const initialRequestedDate = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("date") : null
  const cameFromWeek = !!initialRequestedDate
  const initialDate = initialRequestedDate ? parseISO(initialRequestedDate) : today
  const [tab, setTab] = useState<Tab>("Caisse")
  const [date, setDate] = useState(initialDate)
  const [weekStart, setWeekStart] = useState(startOfWeek(initialDate, { weekStartsOn: 1 }))
  const [viewMonth, setViewMonth] = useState(format(today, "yyyy-MM"))
  const [showAllStaff, setShowAllStaff] = useState(false)
  const { role } = useUserRole()
  const isAdmin = role === "admin"
  const availableTabs = isAdmin ? TABS : (["Caisse"] as const as readonly Tab[])
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
  const balanceSince = format(weekStart, "yyyy-MM-dd")
  const { balance, toDeposit, since, error: balanceError, refetch: refetchBalance } = useCaisseBalance(balanceSince)
  const safeExpenses = Array.isArray(entry.expenses) ? entry.expenses : []

  const { amounts: supplierAmounts, setAmounts: setSupplierAmounts, solidernetMpPct, setSolidernetMpPct, saving: supplierSaving, error: supplierError, save: saveSuppliers } = useMonthlySuppliers(viewMonth)
  const [supplierSaved, setSupplierSaved] = useState(false)

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

  const mpNetCash = cashMonth.cash_mp_divers - cashMonth.virement_mp_divers
  const totalDepensesCash = mpNetCash + cashMonth.cash_rh + cashMonth.cash_charges
  const hasCashDepenses = totalDepensesCash > 0
  const hasCashDepot = cashMonth.cash_depot > 0

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {cameFromWeek && (
        <Link
          href="/semaine"
          className="inline-flex items-center gap-1.5 text-sm text-alaska-sage hover:underline"
        >
          <ChevronLeft size={14} /> Retour semaine
        </Link>
      )}
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
                <button onClick={() => setActiveDate(subDays(date, 1))} className="p-2 hover:bg-alaska-sage-lt rounded-lg transition" aria-label="Jour précédent">
                  <ChevronLeft size={20} className="text-alaska-muted" aria-hidden="true" />
                </button>
                <div className="text-center">
                  <p className="font-semibold text-alaska-dark capitalize">{format(date, "EEEE d MMMM yyyy", { locale: fr })}</p>
                  <p className="text-lg mt-0.5">{statusIcon}</p>
                </div>
                <button onClick={() => setActiveDate(addDays(date, 1))} className="p-2 hover:bg-alaska-sage-lt rounded-lg transition" aria-label="Jour suivant">
                  <ChevronRight size={20} className="text-alaska-muted" aria-hidden="true" />
                </button>
              </div>
              <input
                type="date"
                value={format(date, "yyyy-MM-dd")}
                onChange={(e) => { if (e.target.value) setActiveDate(parseISO(e.target.value)) }}
                className="w-full mt-2 border border-alaska-sage-lt rounded-lg px-3 py-1.5 text-sm text-center text-alaska-dark focus:outline-none focus:ring-1 focus:ring-alaska-sage"
              />
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

      {tab === "Mois" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-alaska-sage-lt rounded-lg p-3">
            <button
              onClick={() => {
                const [year, month] = viewMonth.split("-").map(Number)
                setViewMonth(month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`)
              }}
              className="p-1 hover:bg-alaska-sage-lt rounded"
              aria-label="Mois précédent"
            >
              <ChevronLeft size={18} className="text-alaska-muted" aria-hidden="true" />
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
              aria-label="Mois suivant"
            >
              <ChevronRight size={18} className="text-alaska-muted" aria-hidden="true" />
            </button>
          </div>
          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-base text-alaska-dark">🏭 Fournisseurs mois (virement)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {supplierError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {supplierError}
                </div>
              )}
              {MONTHLY_SUPPLIERS.filter((s) => s.label !== "Solidernet").map((supplier) => (
                <ExpenseRow
                  key={supplier.label}
                  label={supplier.label}
                  value={supplierAmounts[supplier.label as keyof typeof supplierAmounts]}
                  onChange={(value) =>
                    setSupplierAmounts((prev) => ({ ...prev, [supplier.label]: value }))
                  }
                />
              ))}
              <div className="space-y-1.5">
                <ExpenseRow
                  label="Solidernet"
                  value={supplierAmounts["Solidernet"]}
                  onChange={(value) => setSupplierAmounts((prev) => ({ ...prev, Solidernet: value }))}
                />
                <div className="flex items-center justify-end gap-2 pl-2">
                  <span className="text-xs text-alaska-muted">dont alim.</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={solidernetMpPct}
                    onChange={(e) => setSolidernetMpPct(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-14 h-7 text-right text-xs border border-alaska-sage-lt rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-alaska-sage"
                  />
                  <span className="text-xs text-alaska-muted">%</span>
                  {supplierAmounts["Solidernet"] > 0 && (
                    <span className="text-xs text-alaska-muted">
                      = {Math.round(supplierAmounts["Solidernet"] * solidernetMpPct / 100).toLocaleString()} MAD
                    </span>
                  )}
                </div>
              </div>
              <Button
                onClick={async () => {
                  try {
                    await saveSuppliers(supplierAmounts)
                    setSupplierSaved(true)
                    setTimeout(() => setSupplierSaved(false), 2000)
                  } catch {
                    // error already set in hook
                  }
                }}
                disabled={supplierSaving}
                className="w-full bg-alaska-sage text-white hover:bg-alaska-sage/90 font-semibold"
              >
                {supplierSaved ? <><CheckCircle2 size={16} className="mr-2" />Enregistré</> : <><Save size={16} className="mr-2" />Enregistrer fournisseurs</>}
              </Button>
            </CardContent>
          </Card>
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

              {hasCashDepenses && (
                <>
                  <div className="border-t border-alaska-sage-lt pt-2">
                    <p className="text-xs font-semibold text-alaska-muted uppercase tracking-wide mb-2">Dépenses cash</p>
                  </div>
                  {cashMonth.mp_divers_items.length > 0 ? (
                    <>
                      {cashMonth.mp_divers_items.map((item) => (
                        <div key={item.label} className="flex justify-between pl-2">
                          <span className="text-sm text-alaska-muted">{item.label}</span>
                          <span className="font-playfair font-bold text-orange-600">{formatMAD(item.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between">
                        <span className="text-sm text-alaska-dark font-medium">Total achats MP cash</span>
                        <span className="font-playfair font-bold text-green-700">{formatMAD(mpNetCash)}</span>
                      </div>
                    </>
                  ) : (
                    mpNetCash > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-alaska-muted">Achats MP & divers cash</span>
                        <span className="font-playfair font-bold text-green-700">{formatMAD(mpNetCash)}</span>
                      </div>
                    )
                  )}
                  {cashMonth.cash_rh > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-alaska-muted">Salaires cash</span>
                      <span className="font-playfair font-bold text-orange-600">{formatMAD(cashMonth.cash_rh)}</span>
                    </div>
                  )}
                  {cashMonth.cash_charges > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-alaska-muted">Autres charges cash</span>
                      <span className="font-playfair font-bold text-orange-600">{formatMAD(cashMonth.cash_charges)}</span>
                    </div>
                  )}
                  <div className="flex justify-between bg-gray-50 rounded px-2 py-1">
                    <span className="text-sm text-alaska-dark font-semibold">Total dépenses</span>
                    <span className="font-playfair font-bold text-alaska-dark">{formatMAD(totalDepensesCash)}</span>
                  </div>
                </>
              )}

              {hasCashDepot && (
                <>
                  <div className="border-t border-alaska-sage-lt pt-2">
                    <p className="text-xs font-semibold text-alaska-muted uppercase tracking-wide mb-2">Versé en banque</p>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-alaska-muted">Virements banque</span>
                    <span className="font-playfair font-bold text-alaska-muted">{formatMAD(cashMonth.cash_depot)}</span>
                  </div>
                </>
              )}

              <div className="border-t border-alaska-sage-lt pt-2">
                <div className="flex justify-between">
                  <span className="text-sm text-alaska-muted">Cash théorique enveloppe</span>
                  <span className="font-playfair font-bold text-alaska-dark">{formatMAD(cashMonth.cash_envelope)}</span>
                </div>
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
          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-base text-alaska-dark">📊 Pilotage du mois</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-alaska-muted">Prime cost (MP + RH / CA)</span>
                  <span className={cn(
                    "text-sm font-bold",
                    cashMonth.prime_cost_pct < 60 ? "text-green-600" :
                    cashMonth.prime_cost_pct <= 65 ? "text-orange-500" : "text-red-600"
                  )}>
                    {cashMonth.prime_cost_pct > 0 ? `${cashMonth.prime_cost_pct.toFixed(1)} %` : "—"}
                  </span>
                </div>
                {cashMonth.prime_cost_pct > 0 && (
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={cn(
                        "h-2 rounded-full transition-all",
                        cashMonth.prime_cost_pct < 60 ? "bg-green-500" :
                        cashMonth.prime_cost_pct <= 65 ? "bg-orange-400" : "bg-red-500"
                      )}
                      style={{ width: `${Math.min(cashMonth.prime_cost_pct, 100)}%` }}
                    />
                  </div>
                )}
                <p className="text-[11px] text-alaska-muted">Norme restauration : &lt; 65 %</p>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-alaska-sage-lt pt-3">
                <div className="rounded-lg border border-alaska-sage-lt bg-alaska-sage-lt/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-alaska-muted">Coût matière</p>
                  <FoodCostAlert pct={cashMonth.food_cost_pct} className="mt-0.5" />
                </div>
                <MiniPilotageMetric label="Masse salariale" value={cashMonth.staff_cost_pct > 0 ? `${cashMonth.staff_cost_pct.toFixed(1)} %` : "—"} />
                <MiniPilotageMetric label="Charges fixes" value={formatMAD(cashMonth.fixed_charges_total)} />
                <MiniPilotageMetric label="Poids charges" value={cashMonth.fixed_charges_pct > 0 ? `${cashMonth.fixed_charges_pct.toFixed(1)} %` : "—"} />
              </div>
              <div className="flex justify-between items-center border-t border-alaska-sage-lt pt-3">
                <span className="text-sm text-alaska-muted">Résultat net estimé</span>
                <span className={cn(
                  "font-playfair font-bold text-lg",
                  cashMonth.ca_global === 0 ? "text-alaska-muted" :
                  cashMonth.resultat_net >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {cashMonth.ca_global === 0 ? "—" : formatMAD(cashMonth.resultat_net)}
                </span>
              </div>
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

function MiniPilotageMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-alaska-sage-lt bg-alaska-sage-lt/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-alaska-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-alaska-dark">{value}</p>
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
