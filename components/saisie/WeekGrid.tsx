// components/saisie/WeekGrid.tsx
"use client"
import { Fragment, useRef, useState } from "react"
import { format, isAfter, startOfDay, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { Plus } from "lucide-react"
import { DailyEntry } from "@/lib/types"
import { useCharges } from "@/lib/hooks/useCharges"
import { useExpenseTemplates } from "@/lib/hooks/useExpenseTemplates"
import { getCashEnvelope, getCashMovementsReference, getCashSalesReference, hasCashJournal } from "@/lib/cash"
import { formatMAD } from "@/lib/utils"

const today = startOfDay(new Date())

interface WeekGridProps {
  entries: Record<string, DailyEntry>
  dates: string[]
  onUpdateCA: (_date: string, _ca: number) => void
  onUpdateExpense: (
    _date: string,
    _category: "MP" | "RH" | "CHARGES" | "AUTRE",
    _label: string,
    _amount: number
  ) => void
}

function Cell({ value, disabled, readonly, onChange }: { value: number; disabled?: boolean; readonly?: boolean; onChange: (_value: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const ref = useRef<HTMLInputElement>(null)

  if (disabled) return <div className="text-right text-sm px-2 py-1 text-gray-300">—</div>

  if (readonly) {
    return (
      <div className={`text-right text-sm px-2 py-1 ${value === 0 ? "text-gray-300" : "text-gray-500"}`}>
        {value === 0 ? "—" : value.toLocaleString("fr-MA")}
      </div>
    )
  }

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        min={0}
        value={draft}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          setEditing(false)
          onChange(Number(draft) || 0)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Tab") {
            setEditing(false)
            onChange(Number(draft) || 0)
          }
        }}
        className="w-full text-right text-sm px-1 py-0.5 border border-blue-400 rounded outline-none bg-white"
      />
    )
  }

  return (
    <div
      onClick={() => {
        setDraft(value === 0 ? "" : String(value))
        setEditing(true)
      }}
      className={`text-right text-sm px-2 py-1 rounded cursor-pointer hover:bg-blue-50 select-none ${value === 0 ? "text-gray-300" : "text-gray-900 font-medium"}`}
    >
      {value === 0 ? "—" : value.toLocaleString("fr-MA")}
    </div>
  )
}

const SECTION_EMOJI: Record<string, string> = { MP: "🥩", CHARGES: "📦", AUTRE: "📋" }

export function WeekGrid({ entries, dates, onUpdateCA, onUpdateExpense }: WeekGridProps) {
  const [autreLabels, setAutreLabels] = useState<string[]>([])
  const { charges } = useCharges("staff")
  const { sections } = useExpenseTemplates()
  const staff = charges.filter((charge) => charge.is_staff && charge.is_active)

  const getCash = (date: string) => getCashSalesReference(entries[date])
  const cashMovement = (date: string) => getCashMovementsReference(entries[date])
  const getExp = (date: string, cat: string, label: string) =>
    entries[date]?.expenses.find((expense) => expense.category === cat && expense.label === label)?.amount ?? 0
  const totalSorties = (date: string) => entries[date]?.expenses.reduce((sum, expense) => sum + expense.amount, 0) ?? 0
  const solde = (date: string) => getCashEnvelope(entries[date], totalSorties(date))

  const weekCA = dates.reduce((sum, date) => sum + getCash(date), 0)
  const weekSorties = dates.reduce((sum, date) => sum + totalSorties(date), 0)
  const weekSortiesCaisse = dates.reduce((sum, date) => sum + cashMovement(date), 0)
  const weekSolde = weekCA + weekSortiesCaisse - weekSorties
  const tdClass = "px-1 py-0.5"

  const templateLabels = new Set(sections.flatMap((section) => section.items.map((item) => item.label)))
  const staffNames = new Set(staff.map((charge) => charge.name))
  const orphanLabels = new Set<string>()
  dates.forEach((date) => {
    entries[date]?.expenses.forEach((expense) => {
      if (expense.category !== "RH" && !templateLabels.has(expense.label)) orphanLabels.add(expense.label)
      if (expense.category === "RH" && !staffNames.has(expense.label)) orphanLabels.add(expense.label)
    })
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b-2 border-gray-200">
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 w-44">Poste</th>
            {dates.map((date) => (
              <th
                key={date}
                className={`text-center px-2 py-2 text-xs font-semibold capitalize min-w-[88px] ${isAfter(parseISO(date), today) ? "text-gray-300" : "text-gray-700"}`}
              >
                {format(parseISO(date), "EEE dd/MM", { locale: fr })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="bg-blue-50/50 border-b border-gray-200">
            <td className="px-3 py-1.5 text-xs font-bold text-blue-800">💰 CA cash POS</td>
            {dates.map((date) => (
              <td key={date} className={tdClass}>
                <Cell
                  value={getCash(date)}
                  disabled={isAfter(parseISO(date), today)}
                  readonly
                  onChange={(value) => onUpdateCA(date, value)}
                />
              </td>
            ))}
          </tr>

          {sections.map((section) => (
            <Fragment key={section.id}>
              <tr className="bg-orange-50/40">
                <td colSpan={8} className="px-3 py-1 text-xs font-bold text-orange-700">
                  {SECTION_EMOJI[section.expense_category] ?? "📋"} {section.name} cash
                </td>
              </tr>
              {section.items.filter((item) => item.is_active).map((item) => (
                <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="px-3 py-1.5 text-xs text-gray-600 pl-6">{item.label}</td>
                  {dates.map((date) => (
                    <td key={date} className={tdClass}>
                      <Cell
                        value={getExp(date, section.expense_category, item.label)}
                        disabled={isAfter(parseISO(date), today)}
                        onChange={(value) => onUpdateExpense(date, section.expense_category, item.label, value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}

          {staff.length > 0 && (
            <>
              <tr className="bg-purple-50/40">
                <td colSpan={8} className="px-3 py-1 text-xs font-bold text-purple-700">👥 Paiements cash personnel</td>
              </tr>
              {staff.map((employee) => (
                <tr key={employee.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="px-3 py-1.5 text-xs text-gray-600 pl-6">{employee.name}</td>
                  {dates.map((date) => (
                    <td key={date} className={tdClass}>
                      <Cell
                        value={getExp(date, "RH", employee.name)}
                        disabled={isAfter(parseISO(date), today)}
                        onChange={(value) => onUpdateExpense(date, "RH", employee.name, value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </>
          )}

          {orphanLabels.size > 0 && Array.from(orphanLabels).map((label) => (
            <tr key={`orphan-${label}`} className="border-t border-gray-100 bg-yellow-50/20">
              <td className="px-3 py-1.5 text-xs text-gray-400 pl-6 italic">{label}</td>
              {dates.map((date) => {
                const expense = entries[date]?.expenses.find((item) => item.label === label)
                return (
                  <td key={date} className="px-2 py-1 text-right text-xs text-gray-400">
                    {expense ? expense.amount.toLocaleString("fr-MA") : "—"}
                  </td>
                )
              })}
            </tr>
          ))}

          <tr className="bg-gray-50/60">
            <td className="px-3 py-1 text-xs font-bold text-gray-600">
              <span className="flex items-center gap-2">
                ➕ Autre achat cash
                <button onClick={() => setAutreLabels((labels) => [...labels, ""])} className="text-blue-500 hover:text-blue-700">
                  <Plus size={12} />
                </button>
              </span>
            </td>
            <td colSpan={7} />
          </tr>
          {autreLabels.map((label, index) => (
            <tr key={index} className="border-t border-gray-100 hover:bg-gray-50/50">
              <td className="px-3 py-1 pl-6">
                <input
                  className="text-xs border rounded px-1 py-0.5 w-full"
                  placeholder="Libellé..."
                  value={label}
                  onChange={(event) => setAutreLabels((labels) => labels.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                />
              </td>
              {dates.map((date) => (
                <td key={date} className={tdClass}>
                  <Cell
                    value={label ? getExp(date, "AUTRE", label) : 0}
                    disabled={isAfter(parseISO(date), today) || !label}
                    onChange={(value) => label && onUpdateExpense(date, "AUTRE", label, value)}
                  />
                </td>
              ))}
            </tr>
          ))}

          <tr className="border-t-2 border-gray-300 bg-gray-50">
            <td className="px-3 py-2 text-xs font-bold text-gray-700">Achats cash</td>
            {dates.map((date) => (
              <td key={date} className="px-2 py-2 text-right text-xs font-semibold text-orange-700">
                {totalSorties(date) > 0 ? totalSorties(date).toLocaleString("fr-MA") : "—"}
              </td>
            ))}
          </tr>
          <tr className="border-t border-gray-200 bg-amber-50/40">
            <td className="px-3 py-2 text-xs font-bold text-amber-700">Mouvements de caisse POS</td>
            {dates.map((date) => {
              const movement = cashMovement(date)
              return (
                <td key={date} className={`px-2 py-2 text-right text-xs font-semibold ${movement < 0 ? "text-amber-700" : "text-green-700"}`}>
                  {movement === 0 ? "—" : movement.toLocaleString("fr-MA")}
                </td>
              )
            })}
          </tr>
          <tr className="border-t border-gray-200">
            <td className="px-3 py-2 text-xs font-bold">💵 Cash théorique enveloppe</td>
            {dates.map((date) => {
              const balance = solde(date)
              const empty = getCash(date) === 0 && totalSorties(date) === 0 && cashMovement(date) === 0
              const anomaly = entries[date]?.cash_journal_anomaly
              return (
                <td key={date} className={`px-2 py-2 text-right text-xs font-bold ${empty ? "text-gray-300" : balance < 0 ? "text-red-600" : "text-green-700"}`}>
                  {empty ? "—" : `${balance.toLocaleString("fr-MA")}${anomaly ? " *" : ""}`}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap gap-4 text-sm px-3 py-2 bg-[#1F3864]/5 rounded-lg border border-[#1F3864]/10">
        <span className="text-gray-600">Cash POS semaine : <strong>{formatMAD(weekCA)}</strong></span>
        <span className="text-gray-600">Achats cash : <strong className="text-orange-600">{formatMAD(weekSorties)}</strong></span>
        <span className="text-gray-600">Mouvements POS : <strong className={weekSortiesCaisse < 0 ? "text-orange-600" : "text-green-700"}>{formatMAD(weekSortiesCaisse)}</strong></span>
        <span className="text-gray-600">Enveloppe : <strong className={weekSolde < 0 ? "text-red-600" : "text-green-700"}>{formatMAD(weekSolde)}</strong></span>
        {dates.some((date) => hasCashJournal(entries[date]) && entries[date]?.cash_journal_anomaly) && <span className="text-amber-700">* journée en alerte contrôle</span>}
      </div>
    </div>
  )
}
