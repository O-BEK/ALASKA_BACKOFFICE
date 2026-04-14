"use client"
import { useState } from "react"
import { useObjectives } from "@/lib/hooks/useObjectives"
import { formatMAD } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ActionItem } from "@/lib/types"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { cn } from "@/lib/utils"

const TABS = ["Objectifs", "Plan d'action", "Trajectoire"] as const
const LEVER_LABELS: Record<string, string> = {
  soir: "🌙 Soir", terrasse: "☀️ Terrasse", b2b: "💼 B2B",
  marketing: "📱 Marketing", pilotage: "⚙️ Pilotage",
}
const LEVER_COLORS: Record<string, string> = {
  soir: "bg-alaska-sage text-white",
  terrasse: "bg-alaska-gold text-white",
  b2b: "bg-amber-500 text-white",
  marketing: "bg-blue-500 text-white",
  pilotage: "bg-purple-500 text-white",
}
const LEVERS = ["soir", "terrasse", "b2b", "marketing", "pilotage"] as const
const PRIORITIES = ["urgent", "medium", "low"] as const
const MONTHS_FR = ["Jan","Fév","Mars","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]

type ActionFormData = {
  lever: ActionItem["lever"]
  title: string
  description: string
  priority: ActionItem["priority"]
  deadline: string
  budget_min: number
  budget_max: number
  impact: string
}

const EMPTY_FORM: ActionFormData = {
  lever: "pilotage",
  title: "",
  description: "",
  priority: "medium",
  deadline: "",
  budget_min: 0,
  budget_max: 0,
  impact: "",
}

function ActionFormModal({
  initial,
  onClose,
  onSubmit,
  loading,
}: {
  initial: ActionFormData
  onClose: () => void
  onSubmit: (_data: ActionFormData) => void
  loading: boolean
}) {
  const [form, setForm] = useState<ActionFormData>(initial)
  const set = <K extends keyof ActionFormData>(k: K, v: ActionFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="font-playfair text-xl font-bold text-alaska-dark">
          {initial.title ? "Modifier l'action" : "Nouvelle action"}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-alaska-dark">Levier</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {LEVERS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => set("lever", l)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium border transition",
                    form.lever === l
                      ? LEVER_COLORS[l]
                      : "bg-white text-alaska-muted border-alaska-sage-lt hover:bg-alaska-sage-lt"
                  )}
                >
                  {LEVER_LABELS[l]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-alaska-dark">Titre *</label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Titre de l'action"
              className="mt-1 h-9 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-alaska-dark">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Détails optionnels"
              rows={2}
              className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-alaska-sage/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-alaska-dark">Priorité</label>
              <select
                value={form.priority}
                onChange={(e) => set("priority", e.target.value as ActionItem["priority"])}
                className="mt-1 w-full border border-input rounded-md px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-alaska-sage/40"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p === "urgent" ? "🔴 Urgent" : p === "medium" ? "🟡 Normal" : "🟢 Faible"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-alaska-dark">Deadline</label>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => set("deadline", e.target.value)}
                className="mt-1 h-9 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-alaska-dark">Budget min (MAD)</label>
              <Input
                type="number"
                min={0}
                value={form.budget_min}
                onChange={(e) => set("budget_min", Number(e.target.value))}
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-alaska-dark">Budget max (MAD)</label>
              <Input
                type="number"
                min={0}
                value={form.budget_max}
                onChange={(e) => set("budget_max", Number(e.target.value))}
                className="mt-1 h-9 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-alaska-dark">Impact attendu</label>
            <Input
              value={form.impact}
              onChange={(e) => set("impact", e.target.value)}
              placeholder="ex: +15% CA soir"
              className="mt-1 h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1 border-alaska-sage-lt"
            onClick={onClose}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            className="flex-1 bg-alaska-sage hover:bg-alaska-sage/90"
            onClick={() => onSubmit(form)}
            disabled={loading || !form.title.trim()}
          >
            {loading ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ObjectifsPage() {
  const [tab, setTab] = useState<"Objectifs" | "Plan d'action" | "Trajectoire">("Objectifs")
  const {
    actions,
    error,
    updateActionStatus,
    createAction,
    updateAction,
    deleteAction,
    updateMonthlyObjective,
    cumulativeReal,
    yearlyTarget,
    pctAnnuel,
    byLever,
    monthlyObjectives,
    monthlyReal,
  } = useObjectives()

  const [filterLever, setFilterLever] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const safeActions = Array.isArray(actions) ? actions : []
  const safeByLever = Array.isArray(byLever) ? byLever : []
  const safeMonthlyObjectives = Array.isArray(monthlyObjectives) ? monthlyObjectives : []
  const safeMonthlyReal = Array.isArray(monthlyReal) ? monthlyReal : []

  // Action form modal state
  const [actionModal, setActionModal] = useState<{
    open: boolean
    mode: "create" | "edit"
    editId?: string
    initial: ActionFormData
  }>({ open: false, mode: "create", initial: EMPTY_FORM })
  const [actionFormLoading, setActionFormLoading] = useState(false)

  // Delete confirm state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Monthly objective inline edit
  const [editingMonthly, setEditingMonthly] = useState<string | null>(null)
  const [editingMonthlyValue, setEditingMonthlyValue] = useState<string>("")
  const [monthlyLoading, setMonthlyLoading] = useState(false)

  // Alcool dialogue state
  const [alcoolDialogue, setAlcoolDialogue] = useState(false)
  const [alcoolActionId, setAlcoolActionId] = useState("")
  const [alcoolUplift, setAlcoolUplift] = useState(47)
  const [alcoolMonth, setAlcoolMonth] = useState(() => {
    const next = new Date()
    next.setMonth(next.getMonth() + 1)
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`
  })
  const [alcoolLoading, setAlcoolLoading] = useState(false)
  const [alcoolError, setAlcoolError] = useState<string | null>(null)
  const [alcoolPreview, setAlcoolPreview] = useState<{ month: string; before: number; after: number }[]>([])

  const computePreview = (uplift: number, effectMonth: string) => {
    const [effYear, effMonth] = effectMonth.split("-").map(Number)
    const multiplier = 1 + uplift / 100
    return safeMonthlyObjectives
      .filter(mo => mo.year > effYear || (mo.year === effYear && mo.month >= effMonth))
      .map(mo => ({
        month: `${MONTHS_FR[mo.month - 1]} ${mo.year}`,
        before: mo.target_ca,
        after: Math.round(mo.target_ca * multiplier),
      }))
  }

  const handleAlcoolValidate = async () => {
    setAlcoolLoading(true)
    setAlcoolError(null)
    try {
      const res = await fetch("/api/objectives/alcool-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: alcoolActionId, effectMonth: alcoolMonth, upliftPct: alcoolUplift }),
      })
      if (res.ok) {
        setAlcoolDialogue(false)
        window.location.reload()
      } else {
        const json = await res.json().catch(() => ({}))
        setAlcoolError(json.error || `Erreur ${res.status}`)
      }
    } catch {
      setAlcoolError("Erreur réseau — réessaie.")
    } finally {
      setAlcoolLoading(false)
    }
  }

  const handleActionFormSubmit = async (data: ActionFormData) => {
    setActionFormLoading(true)
    if (actionModal.mode === "create") {
      await createAction(data)
    } else if (actionModal.editId) {
      await updateAction({ id: actionModal.editId, ...data })
    }
    setActionFormLoading(false)
    setActionModal({ open: false, mode: "create", initial: EMPTY_FORM })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return
    setDeleteLoading(true)
    await deleteAction(deleteConfirm)
    setDeleteLoading(false)
    setDeleteConfirm(null)
  }

  const handleMonthlyEdit = (key: string, currentValue: number) => {
    setEditingMonthly(key)
    setEditingMonthlyValue(String(currentValue))
  }

  const handleMonthlyCommit = async (year: number, month: number) => {
    const value = Number(editingMonthlyValue)
    if (isNaN(value) || value < 0) {
      setEditingMonthly(null)
      return
    }
    setMonthlyLoading(true)
    await updateMonthlyObjective(year, month, value)
    setMonthlyLoading(false)
    setEditingMonthly(null)
  }

  const monthlyData = safeMonthlyObjectives.map((mo) => {
    const current = safeMonthlyReal.find((item) => item.year === mo.year && item.month === mo.month)
    return { month: MONTHS_FR[mo.month - 1], target: mo.target_ca, real: current?.real || null }
  })

  const filteredActions = safeActions.filter(a =>
    (filterLever === "all" || a.lever === filterLever) &&
    (filterStatus === "all" || a.status === filterStatus)
  )

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Objectifs & Plan d&apos;action</h1>
        <p className="text-alaska-muted text-sm mt-1">Pilotage stratégique Alaska Neo Bistrot 2026</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-2">{error}</div>
      )}

      <div className="flex bg-white border border-alaska-sage-lt rounded-lg p-1 gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("flex-1 py-2 rounded-md text-xs font-medium transition",
              tab === t ? "bg-alaska-sage text-white" : "text-alaska-muted hover:bg-alaska-sage-lt")}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Objectifs" && (
        <div className="space-y-4">
          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardContent className="pt-5 pb-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-alaska-dark">Progression 2026</p>
                  <p className="text-xs text-alaska-muted mt-0.5">Objectif réaliste : {formatMAD(yearlyTarget)}</p>
                </div>
                <span className={cn("text-sm font-bold px-2 py-0.5 rounded-full",
                  pctAnnuel >= 100 ? "bg-alaska-sage text-white" : "bg-alaska-sage-lt text-alaska-sage")}>
                  {pctAnnuel.toFixed(0)}%
                </span>
              </div>
              <p className="font-playfair text-3xl font-bold text-alaska-dark mb-3">{formatMAD(cumulativeReal)}</p>
              <div className="w-full bg-alaska-sage-lt rounded-full h-2.5">
                <div className="h-2.5 rounded-full bg-alaska-sage transition-all duration-700"
                  style={{ width: `${Math.min(pctAnnuel,100)}%` }}/>
              </div>
              <div className="flex justify-between text-xs text-alaska-muted mt-1.5">
                <span>Réel</span>
                <span>Cible : {formatMAD(yearlyTarget)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-alaska-dark">CA mensuel vs Objectif 2026</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#7a7a6a" }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 11, fill: "#7a7a6a" }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={(v: number) => formatMAD(v)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e8ede7", fontSize: "12px" }}/>
                  <Bar dataKey="real" fill="#4a6741" name="CA réel" radius={[4,4,0,0]}/>
                  <Bar dataKey="target" fill="#e8ede7" name="Objectif" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-alaska-dark">Décomposition mensuelle</CardTitle>
              <CardDescription className="text-xs text-alaska-muted">Cliquez sur le montant cible pour le modifier</CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-2">
                {safeMonthlyObjectives.map((mo) => {
                  const key = `${mo.year}-${mo.month}`
                  const real = safeMonthlyReal.find((item) => item.year === mo.year && item.month === mo.month)?.real || 0
                  const pct = mo.target_ca > 0 ? (real / mo.target_ca) * 100 : 0
                  const done = real > 0
                  const isEditing = editingMonthly === key
                  return (
                    <div key={key} className="flex items-center gap-3 p-2 hover:bg-alaska-sage-lt/40 rounded-lg">
                      <span className="text-sm w-10 text-alaska-muted">{MONTHS_FR[mo.month - 1]}</span>
                      <div className="flex-1 bg-alaska-sage-lt rounded-full h-2">
                        <div className={cn("h-2 rounded-full", pct >= 100 ? "bg-alaska-sage" : pct >= 70 ? "bg-amber-400" : "bg-red-400")}
                          style={{ width: `${Math.min(pct,100)}%` }}/>
                      </div>
                      <span className="text-xs w-20 text-right font-medium text-alaska-dark">{done ? formatMAD(real) : "—"}</span>
                      {isEditing ? (
                        <Input
                          type="number"
                          min={0}
                          value={editingMonthlyValue}
                          onChange={(e) => setEditingMonthlyValue(e.target.value)}
                          onBlur={() => handleMonthlyCommit(mo.year, mo.month)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleMonthlyCommit(mo.year, mo.month)
                            if (e.key === "Escape") setEditingMonthly(null)
                          }}
                          className="w-24 h-7 text-xs text-right px-2"
                          disabled={monthlyLoading}
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => handleMonthlyEdit(key, mo.target_ca)}
                          className="text-xs w-16 text-right text-alaska-muted hover:text-alaska-dark hover:underline transition"
                          title="Cliquer pour modifier"
                        >
                          {formatMAD(mo.target_ca)} ✏️
                        </button>
                      )}
                      <span className={cn("text-xs w-12 text-right font-medium",
                        pct >= 100 ? "text-alaska-sage" : pct > 0 ? "text-amber-500" : "text-alaska-muted")}>
                        {done ? `${pct >= 100 ? "✅" : "❌"} ${pct.toFixed(0)}%` : "⏳"}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "Plan d'action" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setActionModal({ open: true, mode: "create", initial: EMPTY_FORM })}
              className="bg-alaska-sage hover:bg-alaska-sage/90 text-white text-xs h-9 px-4 rounded-lg"
            >
              + Nouvelle action
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {safeByLever.map(({ lever, total, done, pct }) => (
              <button key={lever} onClick={() => setFilterLever(f => f === lever ? "all" : lever)}
                className={cn("p-3 rounded-xl border text-left transition bg-white",
                  filterLever === lever ? "border-alaska-sage bg-alaska-sage-lt" : "border-alaska-sage-lt hover:bg-alaska-sage-lt/50")}>
                <p className="text-xs font-medium text-alaska-dark">{LEVER_LABELS[lever]}</p>
                <div className="mt-1.5 bg-alaska-sage-lt rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-alaska-sage" style={{ width: `${pct}%` }}/>
                </div>
                <p className="text-xs text-alaska-muted mt-1">{done}/{total} faites</p>
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            {[["all","Toutes"],["todo","À faire"],["in_progress","En cours"],["done","Faites"]].map(([v,l]) => (
              <button key={v} onClick={() => setFilterStatus(v)}
                className={cn("px-3 py-1 rounded-full text-xs border transition",
                  filterStatus === v ? "bg-alaska-sage text-white border-alaska-sage" : "bg-white text-alaska-muted border-alaska-sage-lt hover:bg-alaska-sage-lt")}>
                {l}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredActions.map(action => (
              <ActionCard
                key={action.id}
                action={action}
                onStatusChange={updateActionStatus}
                leverColors={LEVER_COLORS}
                onAlcoolValidate={(id) => {
                  setAlcoolActionId(id)
                  setAlcoolPreview(computePreview(alcoolUplift, alcoolMonth))
                  setAlcoolDialogue(true)
                }}
                onEdit={(a) => setActionModal({
                  open: true,
                  mode: "edit",
                  editId: a.id,
                  initial: {
                    lever: a.lever,
                    title: a.title,
                    description: a.description,
                    priority: a.priority,
                    deadline: a.deadline,
                    budget_min: a.budget_min,
                    budget_max: a.budget_max,
                    impact: a.impact,
                  },
                })}
                onDelete={(id) => setDeleteConfirm(id)}
              />
            ))}
            {filteredActions.length === 0 && (
              <p className="text-center text-sm text-alaska-muted py-8">Aucune action pour ce filtre</p>
            )}
          </div>
        </div>
      )}

      {tab === "Trajectoire" && (
        <div className="space-y-4">
          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-alaska-dark">Trajectoire 3 ans</CardTitle>
              <CardDescription className="text-xs text-alaska-muted">CA Total (Caisse + B2B)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={[
                  { year: "2025", reel: 1752217 },
                  { year: "2026", prudent: 1927439, realiste: 2277882, ambitieux: 2628326, reel: cumulativeReal },
                  { year: "2027", prudent: 2120183, realiste: 2847352, ambitieux: 3942489 },
                ]}>
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#7a7a6a" }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 11, fill: "#7a7a6a" }} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={(v: number) => formatMAD(v)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e8ede7", fontSize: "12px" }}/>
                  <Line type="monotone" dataKey="reel" stroke="#4a6741" strokeWidth={3} name="Réel" dot={{ r: 5, fill: "#4a6741" }}/>
                  <Line type="monotone" dataKey="realiste" stroke="#c9a96e" strokeWidth={2} strokeDasharray="5 5" name="Réaliste"/>
                  <Line type="monotone" dataKey="prudent" stroke="#7a7a6a" strokeWidth={1.5} strokeDasharray="3 3" name="Prudent"/>
                  <Line type="monotone" dataKey="ambitieux" stroke="#16a34a" strokeWidth={1.5} strokeDasharray="5 5" name="Ambitieux"/>
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardContent className="pt-4 pb-4">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-alaska-muted border-b border-alaska-sage-lt">
                  <th className="text-left pb-2">Année</th>
                  <th className="text-right pb-2">Prudent</th>
                  <th className="text-right pb-2">Réaliste</th>
                  <th className="text-right pb-2">Ambitieux</th>
                </tr></thead>
                <tbody className="divide-y divide-alaska-sage-lt">
                  <tr><td className="py-2 font-medium text-alaska-dark">2025 ✅</td><td/><td className="text-right text-alaska-sage font-bold font-playfair">1 752 217</td><td/></tr>
                  <tr className="bg-alaska-sage-lt/30"><td className="py-2 font-medium text-alaska-dark">2026 🔄</td>
                    <td className="text-right text-alaska-muted">1 927k</td>
                    <td className="text-right font-bold text-alaska-dark font-playfair">2 278k</td>
                    <td className="text-right text-green-600">2 628k</td>
                  </tr>
                  <tr><td className="py-2 font-medium text-alaska-dark">2027</td>
                    <td className="text-right text-alaska-muted">2 120k</td>
                    <td className="text-right text-alaska-muted">2 847k</td>
                    <td className="text-right text-green-500">3 942k</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Form Modal */}
      {actionModal.open && (
        <ActionFormModal
          initial={actionModal.initial}
          onClose={() => setActionModal({ open: false, mode: "create", initial: EMPTY_FORM })}
          onSubmit={handleActionFormSubmit}
          loading={actionFormLoading}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h2 className="font-playfair text-lg font-bold text-alaska-dark">Supprimer l&apos;action ?</h2>
            <p className="text-sm text-alaska-muted">Cette action sera supprimée définitivement.</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-alaska-sage-lt"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteLoading}
              >
                Annuler
              </Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Suppression..." : "Supprimer"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Alcool Dialogue */}
      {alcoolDialogue && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div>
              <h2 className="font-playfair text-xl font-bold text-alaska-dark">🍷 Valider la licence alcool</h2>
              <p className="text-xs text-alaska-muted mt-1">Cela va mettre à jour tes objectifs futurs automatiquement</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-alaska-dark">Date d&apos;effet (mois)</label>
                <Input
                  type="month"
                  value={alcoolMonth}
                  onChange={e => {
                    setAlcoolMonth(e.target.value)
                    setAlcoolPreview(computePreview(alcoolUplift, e.target.value))
                  }}
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-alaska-dark">
                  Uplift ticket moyen : <span className="text-alaska-sage font-bold">+{alcoolUplift}%</span>
                </label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="range" min={10} max={100} step={1}
                    value={alcoolUplift}
                    onChange={e => {
                      setAlcoolUplift(+e.target.value)
                      setAlcoolPreview(computePreview(+e.target.value, alcoolMonth))
                    }}
                    className="flex-1"
                  />
                  <span className="text-sm font-bold text-alaska-sage w-10 text-right">{alcoolUplift}%</span>
                </div>
                <p className="text-xs text-alaska-muted mt-0.5">Ticket moyen actuel : 170 MAD → {Math.round(170 * (1 + alcoolUplift / 100))} MAD</p>
              </div>
            </div>

            {alcoolPreview.length > 0 && (
              <div className="bg-alaska-sage-lt/50 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold text-alaska-dark mb-2">Prévisualisation des objectifs</p>
                {alcoolPreview.map(p => (
                  <div key={p.month} className="flex justify-between text-xs">
                    <span className="text-alaska-muted">{p.month}</span>
                    <span className="text-alaska-muted line-through">{formatMAD(p.before)}</span>
                    <span className="font-medium text-alaska-sage">{formatMAD(p.after)}</span>
                  </div>
                ))}
              </div>
            )}

            {alcoolError && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{alcoolError}</p>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 border-alaska-sage-lt"
                onClick={() => setAlcoolDialogue(false)}
                disabled={alcoolLoading}
              >
                Annuler
              </Button>
              <Button
                className="flex-1 bg-alaska-sage hover:bg-alaska-sage/90"
                onClick={handleAlcoolValidate}
                disabled={alcoolLoading}
              >
                {alcoolLoading ? "Mise à jour..." : "Confirmer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ActionCard({
  action,
  onStatusChange,
  leverColors,
  onAlcoolValidate,
  onEdit,
  onDelete,
}: {
  action: ActionItem
  onStatusChange: (_id: string, _status: ActionItem["status"]) => void
  leverColors: Record<string, string>
  onAlcoolValidate?: (_id: string) => void
  onEdit?: (_action: ActionItem) => void
  onDelete?: (_id: string) => void
}) {
  const next: Record<ActionItem["status"], ActionItem["status"]> = {
    todo: "in_progress", in_progress: "done", done: "todo", cancelled: "todo"
  }
  const isAlcool = action.title.toLowerCase().includes("alcool")
  return (
    <Card className={cn("bg-white border-l-4 border border-alaska-sage-lt rounded-xl",
      action.priority === "urgent" ? "border-l-red-500" : action.priority === "medium" ? "border-l-amber-400" : "border-l-alaska-sage")}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full", leverColors[action.lever] || "bg-gray-200 text-gray-700")}>
                {action.lever.toUpperCase()}
              </span>
              <span className="text-xs text-alaska-muted">{action.deadline}</span>
            </div>
            <p className="font-medium text-sm text-alaska-dark">{action.title}</p>
            {action.description && <p className="text-xs text-alaska-muted mt-1 leading-relaxed">{action.description}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onEdit && (
              <button
                onClick={() => onEdit(action)}
                className="p-1.5 rounded-lg text-alaska-muted hover:text-alaska-dark hover:bg-alaska-sage-lt transition"
                title="Modifier"
              >
                ✏️
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(action.id)}
                className="p-1.5 rounded-lg text-alaska-muted hover:text-red-500 hover:bg-red-50 transition"
                title="Supprimer"
              >
                🗑️
              </button>
            )}
            {isAlcool && action.status !== "done" && onAlcoolValidate ? (
              <button
                onClick={() => onAlcoolValidate(action.id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border transition bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
              >
                🍷 Valider licence
              </button>
            ) : (
              <button onClick={() => onStatusChange(action.id, next[action.status])}
                className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition",
                  action.status === "done" ? "bg-alaska-sage-lt text-alaska-sage border-alaska-sage"
                  : action.status === "in_progress" ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-white text-alaska-muted border-alaska-sage-lt hover:bg-alaska-sage-lt")}>
                {action.status === "done" ? "✅ Fait" : action.status === "in_progress" ? "🔄 En cours" : "○ À faire"}
              </button>
            )}
          </div>
        </div>
        {action.budget_max > 0 && (
          <p className="text-xs text-alaska-muted mt-2">
            Budget : {formatMAD(action.budget_min)}{action.budget_max !== action.budget_min ? ` – ${formatMAD(action.budget_max)}` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
