// components/saisie/WeekGrid.tsx
"use client"
import { useState, useRef } from "react"
import { format, isAfter, startOfDay, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { Plus } from "lucide-react"
import { DailyEntry } from "@/lib/types"
import { FIXED_CHARGES } from "@/lib/mock-data"
import { formatMAD } from "@/lib/utils"

const MP_POSTES = ["Poissonnier","Boucher","Poulet","Eau","Technicien & courses"]
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

function Cell({ value, disabled, onChange }: { value: number; disabled?: boolean; onChange: (_value: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const ref = useRef<HTMLInputElement>(null)

  if (disabled) return <div className="text-right text-sm px-2 py-1 text-gray-300">—</div>

  if (editing) {
    return (
      <input ref={ref} type="number" min={0} value={draft} autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); onChange(Number(draft) || 0) }}
        onKeyDown={e => { if (e.key === "Enter" || e.key === "Tab") { setEditing(false); onChange(Number(draft) || 0) } }}
        className="w-full text-right text-sm px-1 py-0.5 border border-blue-400 rounded outline-none bg-white"
      />
    )
  }

  return (
    <div onClick={() => { setDraft(value === 0 ? "" : String(value)); setEditing(true) }}
      className={`text-right text-sm px-2 py-1 rounded cursor-pointer hover:bg-blue-50 select-none ${value === 0 ? "text-gray-300" : "text-gray-900 font-medium"}`}>
      {value === 0 ? "—" : value.toLocaleString("fr-MA")}
    </div>
  )
}

export function WeekGrid({ entries, dates, onUpdateCA, onUpdateExpense }: WeekGridProps) {
  const [autreLabels, setAutreLabels] = useState<string[]>([])
  const staff = FIXED_CHARGES.filter(c => c.is_staff && c.is_active)

  const getCA = (date: string) => entries[date]?.ca_caisse ?? 0
  const getExp = (date: string, cat: string, label: string) =>
    entries[date]?.expenses.find(e => e.category === cat && e.label === label)?.amount ?? 0
  const totalSorties = (date: string) => entries[date]?.expenses.reduce((s, e) => s + e.amount, 0) ?? 0
  const solde = (date: string) => getCA(date) - totalSorties(date)

  const weekCA = dates.reduce((s, d) => s + getCA(d), 0)
  const weekSorties = dates.reduce((s, d) => s + totalSorties(d), 0)
  const weekSolde = weekCA - weekSorties
  const tdClass = "px-1 py-0.5"

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b-2 border-gray-200">
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 w-44">Poste</th>
            {dates.map(d => (
              <th key={d} className={`text-center px-2 py-2 text-xs font-semibold capitalize min-w-[88px] ${isAfter(parseISO(d), today) ? "text-gray-300" : "text-gray-700"}`}>
                {format(parseISO(d), "EEE dd/MM", { locale: fr })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="bg-blue-50/50 border-b border-gray-200">
            <td className="px-3 py-1.5 text-xs font-bold text-blue-800">💰 CA Caisse</td>
            {dates.map(d => (
              <td key={d} className={tdClass}>
                <Cell value={getCA(d)} disabled={isAfter(parseISO(d), today) || entries[d]?.source === "csv_import"} onChange={v => onUpdateCA(d, v)} />
              </td>
            ))}
          </tr>
          <tr className="bg-orange-50/40"><td colSpan={8} className="px-3 py-1 text-xs font-bold text-orange-700">🥩 Matières Premières</td></tr>
          {MP_POSTES.map(label => (
            <tr key={label} className="border-t border-gray-100 hover:bg-gray-50/50">
              <td className="px-3 py-1.5 text-xs text-gray-600 pl-6">{label}</td>
              {dates.map(d => (
                <td key={d} className={tdClass}>
                  <Cell value={getExp(d, "MP", label)} disabled={isAfter(parseISO(d), today)} onChange={v => onUpdateExpense(d, "MP", label, v)} />
                </td>
              ))}
            </tr>
          ))}
          <tr className="bg-purple-50/40"><td colSpan={8} className="px-3 py-1 text-xs font-bold text-purple-700">👥 Personnel</td></tr>
          {staff.map(emp => (
            <tr key={emp.id} className="border-t border-gray-100 hover:bg-gray-50/50">
              <td className="px-3 py-1.5 text-xs text-gray-600 pl-6">{emp.name}</td>
              {dates.map(d => (
                <td key={d} className={tdClass}>
                  <Cell value={getExp(d, "RH", emp.name)} disabled={isAfter(parseISO(d), today)} onChange={v => onUpdateExpense(d, "RH", emp.name, v)} />
                </td>
              ))}
            </tr>
          ))}
          <tr className="bg-gray-50/60">
            <td className="px-3 py-1 text-xs font-bold text-gray-600 flex items-center gap-2">
              📦 Autre
              <button onClick={() => setAutreLabels(l => [...l, ""])} className="ml-1 text-blue-500 hover:text-blue-700"><Plus size={12} /></button>
            </td>
            <td colSpan={7} />
          </tr>
          {autreLabels.map((lbl, idx) => (
            <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50/50">
              <td className="px-3 py-1 pl-6">
                <input className="text-xs border rounded px-1 py-0.5 w-full" placeholder="Libellé..."
                  value={lbl} onChange={e => setAutreLabels(l => l.map((x, i) => i === idx ? e.target.value : x))} />
              </td>
              {dates.map(d => (
                <td key={d} className={tdClass}>
                  <Cell value={lbl ? getExp(d, "AUTRE", lbl) : 0} disabled={isAfter(parseISO(d), today) || !lbl}
                    onChange={v => lbl && onUpdateExpense(d, "AUTRE", lbl, v)} />
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t-2 border-gray-300 bg-gray-50">
            <td className="px-3 py-2 text-xs font-bold text-gray-700">Total sorties</td>
            {dates.map(d => (
              <td key={d} className="px-2 py-2 text-right text-xs font-semibold text-orange-700">
                {totalSorties(d) > 0 ? totalSorties(d).toLocaleString("fr-MA") : "—"}
              </td>
            ))}
          </tr>
          <tr className="border-t border-gray-200">
            <td className="px-3 py-2 text-xs font-bold">💵 Solde caisse</td>
            {dates.map(d => {
              const s = solde(d)
              const isEmpty = getCA(d) === 0 && totalSorties(d) === 0
              return (
                <td key={d} className={`px-2 py-2 text-right text-xs font-bold ${isEmpty ? "text-gray-300" : s < 0 ? "text-red-600" : "text-green-700"}`}>
                  {isEmpty ? "—" : s.toLocaleString("fr-MA")}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap gap-4 text-sm px-3 py-2 bg-[#1F3864]/5 rounded-lg border border-[#1F3864]/10">
        <span className="text-gray-600">CA semaine : <strong>{formatMAD(weekCA)}</strong></span>
        <span className="text-gray-600">Sorties : <strong className="text-orange-600">{formatMAD(weekSorties)}</strong></span>
        <span className="text-gray-600">Solde : <strong className={weekSolde < 0 ? "text-red-600" : "text-green-700"}>{formatMAD(weekSolde)}</strong></span>
      </div>
    </div>
  )
}
