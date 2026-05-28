"use client"

import { useEffect, useState } from "react"
import { CalendarRange, Lock, Plus, Trash2, Edit2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { CalendarEvent } from "@/lib/calendar-context"

const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]
const IMPACT_LABELS: Record<string, string> = { closed: "Fermeture", reduced: "Réduit", boost: "Boost" }
const IMPACT_COLORS: Record<string, string> = {
  closed: "bg-red-100 text-red-700",
  reduced: "bg-amber-100 text-amber-700",
  boost: "bg-green-100 text-green-700",
}
const TYPE_LABELS: Record<string, string> = {
  school_holiday: "Vacances scolaires",
  public_holiday: "Jour férié",
  religious: "Fête religieuse",
  closure: "Fermeture",
  high_traffic: "Haute affluence",
}

type FormState = {
  date_start: string
  date_end: string
  type: string
  name: string
  impact: string
  notes: string
}

const EMPTY_FORM: FormState = { date_start: "", date_end: "", type: "closure", name: "", impact: "closed", notes: "" }

export default function CalendrierPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch(`/api/calendar-events?year=${year}`)
      .then(r => r.json())
      .then(d => setEvents(d.events || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [year])

  const saveEvent = async () => {
    setSaving(true)
    setError(null)
    try {
      const method = editId ? "PUT" : "POST"
      const body = editId ? { id: editId, ...form } : form
      const res = await fetch("/api/calendar-events", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowForm(false)
      setEditId(null)
      setForm(EMPTY_FORM)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  const deleteEvent = async (id: string) => {
    if (!confirm("Supprimer cet événement ?")) return
    await fetch(`/api/calendar-events?id=${id}`, { method: "DELETE" })
    load()
  }

  const startEdit = (event: CalendarEvent) => {
    setForm({ date_start: event.date_start, date_end: event.date_end, type: event.type, name: event.name, impact: event.impact, notes: event.notes || "" })
    setEditId(event.id)
    setShowForm(true)
  }

  const eventsByMonth = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, "0")
    const monthEvents = events.filter(e => e.date_start.slice(0, 7) <= `${year}-${m}` && e.date_end.slice(0, 7) >= `${year}-${m}`)
    return { month: i, label: MONTHS_FR[i], events: monthEvents }
  }).filter(m => m.events.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarRange size={20} className="text-alaska-sage" />
          <h1 className="text-xl font-bold text-alaska-dark">Calendrier</h1>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setYear(y => y - 1)}>‹</Button>
            <span className="text-sm font-medium px-2">{year}</span>
            <Button variant="ghost" size="sm" onClick={() => setYear(y => y + 1)}>›</Button>
          </div>
        </div>
        <Button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM) }} size="sm">
          <Plus size={14} className="mr-1" /> Ajouter
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{editId ? "Modifier l'événement" : "Nouvel événement"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-alaska-muted mb-1 block">Date début</label>
                <input type="date" value={form.date_start} onChange={e => setForm(f => ({...f, date_start: e.target.value}))}
                  className="w-full text-sm px-2 py-1.5 border rounded-lg" />
              </div>
              <div>
                <label className="text-xs text-alaska-muted mb-1 block">Date fin</label>
                <input type="date" value={form.date_end} onChange={e => setForm(f => ({...f, date_end: e.target.value}))}
                  className="w-full text-sm px-2 py-1.5 border rounded-lg" />
              </div>
            </div>
            <div>
              <label className="text-xs text-alaska-muted mb-1 block">Nom</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                placeholder="ex: Fermeture Aïd al-Adha"
                className="w-full text-sm px-2 py-1.5 border rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-alaska-muted mb-1 block">Type</label>
                <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}
                  className="w-full text-sm px-2 py-1.5 border rounded-lg">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-alaska-muted mb-1 block">Impact</label>
                <select value={form.impact} onChange={e => setForm(f => ({...f, impact: e.target.value}))}
                  className="w-full text-sm px-2 py-1.5 border rounded-lg">
                  <option value="closed">Fermeture</option>
                  <option value="reduced">Réduit</option>
                  <option value="boost">Boost</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-alaska-muted mb-1 block">Notes (optionnel)</label>
              <input type="text" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                className="w-full text-sm px-2 py-1.5 border rounded-lg" />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button onClick={saveEvent} disabled={saving} size="sm">{saving ? "Enregistrement..." : "Enregistrer"}</Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setEditId(null) }}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-alaska-muted">Chargement...</p>
      ) : eventsByMonth.length === 0 ? (
        <p className="text-sm text-alaska-muted">Aucun événement en {year}.</p>
      ) : (
        <div className="space-y-4">
          {eventsByMonth.map(({ month, label, events: monthEvents }) => (
            <div key={month}>
              <h3 className="text-xs font-semibold text-alaska-muted uppercase tracking-wide mb-2">{label}</h3>
              <div className="space-y-1.5">
                {monthEvents.map(event => (
                  <div key={event.id} className="flex items-start justify-between gap-3 bg-white border border-gray-100 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-alaska-dark truncate">{event.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${IMPACT_COLORS[event.impact]}`}>
                          {IMPACT_LABELS[event.impact]}
                        </span>
                        {!event.editable && <Lock size={12} className="text-alaska-muted flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-alaska-muted mt-0.5">
                        {event.date_start === event.date_end ? event.date_start : `${event.date_start} → ${event.date_end}`}
                        {event.notes && ` · ${event.notes}`}
                      </p>
                    </div>
                    {event.editable && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => startEdit(event)} className="p-1.5 hover:bg-gray-100 rounded text-alaska-muted">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => deleteEvent(event.id)} className="p-1.5 hover:bg-red-50 rounded text-red-400">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
