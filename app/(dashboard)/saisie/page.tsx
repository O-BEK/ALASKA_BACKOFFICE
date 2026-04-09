"use client"
import { useEffect, useState } from "react"
import { format, addDays, subDays, startOfWeek, addWeeks, subWeeks, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { useDailyEntry } from "@/lib/hooks/useDailyEntry"
import { useDashboard } from "@/lib/hooks/useDashboard"
import { useWeekView } from "@/lib/hooks/useWeekView"
import { useWeekEntries } from "@/lib/hooks/useWeekEntries"
import { useCaisseBalance } from "@/lib/hooks/useCaisseBalance"
import { FIXED_CHARGES } from "@/lib/mock-data"
import { formatMAD } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, CheckCircle2, Minus, Plus, ChevronDown, ChevronUp, Save, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { WeekGrid } from "@/components/saisie/WeekGrid"

const TABS = ["Saisie", "Semaine", "Mois"] as const
type Tab = typeof TABS[number]

const MP_POSTES = ["Poissonnier","Boucher","Poulet","Eau","Technicien & courses"]
const AUTRES_POSTES = ["Loyer","Électricité","Gaz","Internet","Autre"]

export default function SaisiePage() {
  const today = new Date()
  const initialRequestedDate = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("date") : null
  const initialDate = initialRequestedDate ? parseISO(initialRequestedDate) : today
  const [tab, setTab] = useState<Tab>("Saisie")
  const [date, setDate] = useState(initialDate)
  const [weekStart, setWeekStart] = useState(startOfWeek(initialDate, { weekStartsOn: 1 }))
  const [viewMonth, setViewMonth] = useState(format(today, "yyyy-MM"))
  const [showAllStaff, setShowAllStaff] = useState(false)

  useEffect(() => {
    const requestedDate = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("date") : null
    if (!requestedDate) return
    const nextDate = parseISO(requestedDate)
    setDate(nextDate)
    setWeekStart(startOfWeek(nextDate, { weekStartsOn: 1 }))
  }, [])

  const dateStr = format(date, "yyyy-MM-dd")
  const { entry, update, updateExpense, addExpense, save, saved } = useDailyEntry(dateStr)
  const { kpis: monthKpis } = useDashboard(viewMonth)
  const weekData = useWeekView(weekStart)
  const { entries: weekEntries, dates: weekDates, updateCA: updateWeekCA, updateExpense: updateWeekExpense } = useWeekEntries(weekStart)
  const { balance, toDeposit, since, refetch: refetchBalance } = useCaisseBalance()
  const [virementOpen, setVirementOpen] = useState(false)
  const safeExpenses = Array.isArray(entry.expenses) ? entry.expenses : []
  const safeWeekDays = Array.isArray(weekData.days) ? weekData.days : []

  const staff = FIXED_CHARGES.filter(c => c.is_staff && c.is_active)
  const visibleStaff = showAllStaff ? staff : staff.filter(s => {
    const exp = safeExpenses.find(e => e.label === s.name)
    return exp && exp.amount > 0
  })

  const getOrCreateExpense = (label: string, category: "MP" | "RH" | "CHARGES" | "AUTRE") => {
    return safeExpenses.find(e => e.label === label) || { id: `${label}-${dateStr}`, category, label, amount: 0 }
  }

  const handleExpenseChange = (label: string, category: "MP" | "RH" | "CHARGES" | "AUTRE", amount: number) => {
    const existing = safeExpenses.find(e => e.label === label)
    if (existing) {
      updateExpense(existing.id, Math.max(0, amount))
    } else if (amount > 0) {
      addExpense({ id: `${label}-${dateStr}-${Date.now()}`, category, label, amount })
    }
  }

  const totalExpenses = safeExpenses.reduce((s, e) => s + e.amount, 0)
  const soldeCaisse = entry.ca_caisse - totalExpenses
  const statusIcon = entry.ca_caisse > 0 && totalExpenses > 0 ? "✅"
    : entry.ca_caisse > 0 || totalExpenses > 0 ? "🟡" : "⬜"

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Tabs */}
      <div className="flex bg-white border border-alaska-sage-lt rounded-lg p-1 gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("flex-1 py-2 rounded-md text-sm font-medium transition",
              tab === t ? "bg-alaska-sage text-white" : "text-alaska-muted hover:bg-alaska-sage-lt")}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Saisie" && (
        <div className="space-y-4">
          <Card className="bg-alaska-dark text-white rounded-xl">
            <CardContent className="pt-4 pb-4 space-y-2">
              <p className="text-[11px] text-alaska-muted uppercase tracking-wide mb-1">Solde caisse cumulé</p>
              <div className="flex justify-between items-center">
                <span className="text-sm text-alaska-muted">En caisse</span>
                <span className="font-playfair font-bold text-lg text-white">{formatMAD(balance)}</span>
              </div>
              <div className="border-t border-white/20 pt-2 flex justify-between items-center">
                <span className="text-sm text-alaska-muted">À déposer</span>
                <span className={cn("font-playfair font-bold text-lg", toDeposit > 0 ? "text-alaska-gold" : "text-alaska-muted")}>
                  {formatMAD(toDeposit)}
                </span>
              </div>
              <p className="text-[10px] text-alaska-muted text-right">
                {since ? `Depuis lun. ${since.slice(8)}/${since.slice(5)} · ` : ""}Réserve 1 000 MAD · Fonds permanent 1 500 MAD hors app
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <button onClick={() => setDate(d => subDays(d, 1))} className="p-2 hover:bg-alaska-sage-lt rounded-lg transition">
                  <ChevronLeft size={20} className="text-alaska-muted"/>
                </button>
                <div className="text-center">
                  <p className="font-semibold text-alaska-dark capitalize">
                    {format(date, "EEEE d MMMM yyyy", { locale: fr })}
                  </p>
                  <p className="text-lg mt-0.5">{statusIcon}</p>
                </div>
                <button onClick={() => setDate(d => addDays(d, 1))} className="p-2 hover:bg-alaska-sage-lt rounded-lg transition">
                  <ChevronRight size={20} className="text-alaska-muted"/>
                </button>
              </div>
              <button onClick={() => setDate(today)}
                className="w-full mt-2 text-xs text-alaska-sage hover:underline">Aujourd&apos;hui</button>
            </CardContent>
          </Card>

          <Card className="bg-white border-l-4 border-alaska-sage border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-base flex items-center gap-2 text-alaska-dark">
                💰 CA Caisse du jour
                {entry.source === "csv_import" && (
                  <span className="text-xs bg-alaska-sage-lt text-alaska-sage px-2 py-0.5 rounded-full font-normal">Import CSV</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Input type="number" value={entry.ca_caisse || ""}
                  onChange={e => update({ ca_caisse: parseFloat(e.target.value) || 0 })}
                  placeholder="0" className="text-2xl font-playfair font-bold h-14 text-right focus:ring-alaska-sage focus:border-alaska-sage"
                  readOnly={entry.source === "csv_import"}/>
                <span className="text-alaska-muted font-medium">MAD</span>
              </div>
              <div className="flex gap-2">
                {[500,1000,2000,5000].map(v => (
                  <button key={v} onClick={() => update({ ca_caisse: entry.ca_caisse + v })}
                    className="flex-1 py-1.5 text-xs border border-alaska-sage-lt text-alaska-sage rounded-md hover:bg-alaska-sage-lt transition">
                    +{v}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-alaska-sage-lt">
                <span className="text-sm text-alaska-muted flex-1">Mouvement caisse</span>
                <Input type="number" value={entry.mouvement_caisse || ""}
                  onChange={e => update({ mouvement_caisse: parseFloat(e.target.value) || 0 })}
                  placeholder="0" className="w-32 text-right text-sm focus:ring-alaska-sage focus:border-alaska-sage"/>
                <span className="text-alaska-muted text-sm">MAD</span>
              </div>
              <Input placeholder="Notes (Ramadan, groupe, événement...)" value={entry.notes}
                onChange={e => update({ notes: e.target.value })}
                className="text-sm focus:ring-alaska-sage focus:border-alaska-sage"/>
            </CardContent>
          </Card>

          <ExpenseGroup title="🥩 Matières Premières" defaultOpen>
            {MP_POSTES.map(label => {
              const exp = getOrCreateExpense(label, "MP")
              return <ExpenseRow key={label} label={label} value={exp.amount} onChange={v => handleExpenseChange(label, "MP", v)}/>
            })}
          </ExpenseGroup>

          <ExpenseGroup title="👥 Personnel">
            <div className="space-y-2">
              {visibleStaff.map(s => {
                const exp = getOrCreateExpense(s.name, "RH")
                return (
                  <ExpenseRow key={s.id} label={`${s.name}${s.payment_day ? ` (j.${s.payment_day})` : ""}`}
                    value={exp.amount} onChange={v => handleExpenseChange(s.name, "RH", v)}/>
                )
              })}
              <button onClick={() => setShowAllStaff(v => !v)}
                className="w-full text-xs text-alaska-sage hover:underline pt-1">
                {showAllStaff ? "Masquer" : `Afficher tout le personnel (${staff.length})`}
              </button>
            </div>
          </ExpenseGroup>

          <ExpenseGroup title="📦 Autres Charges">
            {AUTRES_POSTES.map(label => {
              const exp = getOrCreateExpense(label, "CHARGES")
              return <ExpenseRow key={label} label={label} value={exp.amount} onChange={v => handleExpenseChange(label, "CHARGES", v)}/>
            })}
          </ExpenseGroup>

          <Card className="bg-white border-l-4 border-alaska-gold border border-alaska-sage-lt rounded-xl">
            <button
              onClick={() => setVirementOpen(v => !v)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="font-semibold text-alaska-dark text-sm">🏦 Virement banque</span>
              {virementOpen ? <ChevronUp size={18} className="text-alaska-muted"/> : <ChevronDown size={18} className="text-alaska-muted"/>}
            </button>
            {virementOpen && (
              <CardContent className="pt-0 pb-4">
                <ExpenseRow
                  label="Virement banque"
                  value={getOrCreateExpense("Virement banque", "CHARGES").amount}
                  onChange={v => handleExpenseChange("Virement banque", "CHARGES", v)}
                />
              </CardContent>
            )}
          </Card>

          <Card className="bg-alaska-dark text-white rounded-xl">
            <CardContent className="pt-4 pb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-alaska-muted">CA Caisse</span>
                <span className="font-semibold">{formatMAD(entry.ca_caisse)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-alaska-muted">Total sorties</span>
                <span className="font-semibold text-orange-300">-{formatMAD(totalExpenses)}</span>
              </div>
              <div className="border-t border-white/20 pt-2 flex justify-between font-bold text-base">
                <span>💵 Solde caisse</span>
                <span className={cn("font-playfair text-lg", soldeCaisse >= 0 ? "text-alaska-gold" : "text-red-400")}>
                  {soldeCaisse < 0 ? "-" : ""}{formatMAD(Math.abs(soldeCaisse))}
                  {soldeCaisse < 0 && " ⚠"}
                </span>
              </div>
              <Button onClick={async () => { await save(); refetchBalance() }} className="w-full mt-3 bg-white text-alaska-dark hover:bg-alaska-sage-lt font-semibold">
                {saved ? <><CheckCircle2 size={16} className="mr-2"/>Enregistré</> : <><Save size={16} className="mr-2"/>Enregistrer</>}
              </Button>
              {!saved && <p className="text-center text-xs text-alaska-muted flex items-center justify-center gap-1"><Clock size={10}/>Sauvegarde auto dans 2s</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "Semaine" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-alaska-sage-lt rounded-lg p-3">
            <button onClick={() => setWeekStart(w => subWeeks(w, 1))} className="p-1 hover:bg-alaska-sage-lt rounded transition">
              <ChevronLeft size={18} className="text-alaska-muted"/>
            </button>
            <p className="text-sm font-semibold text-alaska-dark">
              {format(weekStart, "d MMM", { locale: fr })} – {format(addDays(weekStart, 6), "d MMM yyyy", { locale: fr })}
            </p>
            <button onClick={() => setWeekStart(w => addWeeks(w, 1))} className="p-1 hover:bg-alaska-sage-lt rounded transition">
              <ChevronRight size={18} className="text-alaska-muted"/>
            </button>
          </div>
          <div className="hidden md:block bg-white border border-alaska-sage-lt rounded-xl p-4">
            <WeekGrid entries={weekEntries} dates={weekDates} onUpdateCA={updateWeekCA} onUpdateExpense={updateWeekExpense}/>
          </div>
          <div className="md:hidden space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-white border border-alaska-sage-lt rounded-xl">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-alaska-muted">CA semaine</p>
                  <p className="text-xl font-playfair font-bold text-alaska-dark">{formatMAD(weekData.totalCA)}</p>
                  <p className="text-xs text-alaska-muted">{weekData.pctBreakeven.toFixed(0)}% du seuil</p>
                </CardContent>
              </Card>
              <Card className="bg-white border border-alaska-sage-lt rounded-xl">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-alaska-muted">Dépenses</p>
                  <p className="text-xl font-playfair font-bold text-orange-600">{formatMAD(weekData.totalDep)}</p>
                  <p className="text-xs text-alaska-muted">Solde : {formatMAD(weekData.totalCA - weekData.totalDep)}</p>
                </CardContent>
              </Card>
            </div>
            <Card className="bg-white border border-alaska-sage-lt rounded-xl">
              <CardContent className="pt-4 pb-2 space-y-2">
                {safeWeekDays.map(day => (
                  <button key={day.date} onClick={() => { setDate(new Date(day.date)); setTab("Saisie") }}
                    className="w-full flex items-center justify-between p-3 bg-alaska-sage-lt/40 hover:bg-alaska-sage-lt rounded-lg transition text-left">
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{day.status === "full" ? "✅" : day.status === "partial" ? "🟡" : "⬜"}</span>
                      <span className="text-sm font-medium capitalize text-alaska-dark">{day.label}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-alaska-dark">{day.entry ? formatMAD(day.entry.ca_caisse) : "—"}</p>
                      {day.totalExpenses > 0 && <p className="text-xs text-alaska-muted">Dép: {formatMAD(day.totalExpenses)}</p>}
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
            <button onClick={() => {
              const [y,m] = viewMonth.split("-").map(Number)
              setViewMonth(m===1?`${y-1}-12`:`${y}-${String(m-1).padStart(2,"0")}`)
            }} className="p-1 hover:bg-alaska-sage-lt rounded"><ChevronLeft size={18} className="text-alaska-muted"/></button>
            <p className="text-sm font-semibold text-alaska-dark">{viewMonth}</p>
            <button onClick={() => {
              const [y,m] = viewMonth.split("-").map(Number)
              setViewMonth(m===12?`${y+1}-01`:`${y}-${String(m+1).padStart(2,"0")}`)
            }} className="p-1 hover:bg-alaska-sage-lt rounded"><ChevronRight size={18} className="text-alaska-muted"/></button>
          </div>
          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-alaska-muted">CA Caisse (importé)</span>
                <span className="font-playfair font-bold text-alaska-dark">{formatMAD(monthKpis.ca_caisse)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-alaska-muted">Dépenses</span>
                <span className="font-playfair font-bold text-orange-600">{formatMAD(monthKpis.total_expenses)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-alaska-muted">Solde mois</span>
                <span className="font-playfair font-bold text-alaska-dark">{formatMAD(monthKpis.ca_caisse - monthKpis.total_expenses)}</span>
              </div>
              <p className="text-xs text-alaska-muted text-center pt-2">Vue simplifiée — synthèse mensuelle consolidée</p>
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
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between p-4 text-left">
        <span className="font-semibold text-alaska-dark text-sm">{title}</span>
        {open ? <ChevronUp size={18} className="text-alaska-muted"/> : <ChevronDown size={18} className="text-alaska-muted"/>}
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
        <button onClick={() => onChange(Math.max(0, value - 100))}
          className="w-7 h-7 flex items-center justify-center border border-alaska-sage-lt rounded-md hover:bg-alaska-sage-lt">
          <Minus size={12} className="text-alaska-muted"/>
        </button>
        <input type="number" value={value || ""} placeholder="0"
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-24 h-8 text-right text-sm border border-alaska-sage-lt rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-alaska-sage focus:border-alaska-sage"/>
        <button onClick={() => onChange(value + 100)}
          className="w-7 h-7 flex items-center justify-center border border-alaska-sage-lt rounded-md hover:bg-alaska-sage-lt">
          <Plus size={12} className="text-alaska-muted"/>
        </button>
      </div>
    </div>
  )
}
