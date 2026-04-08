"use client"
import { useState } from "react"
import { useCharges } from "@/lib/hooks/useCharges"
import { formatMAD } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Edit2, UserX, Zap } from "lucide-react"

const CAT_LABELS: Record<string, string> = {
  IMMOBILIER: "🏠 Immobilier", PERSONNEL: "👥 Personnel",
  ENERGIE: "⚡ Énergie", TELECOM: "📡 Télécom", DIVERS: "📦 Divers",
}

export default function ChargesPage() {
  const { byCategory, totalActive, breakeven, simExtra, setSimExtra, simulatedBreakeven, updateCharge, deactivateCharge } = useCharges()
  const [editId, setEditId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState("")
  const [showSim, setShowSim] = useState(false)
  const [simSalaire, setSimSalaire] = useState(5000)

  const handleSave = (id: string) => {
    updateCharge(id, parseFloat(editVal) || 0)
    setEditId(null)
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="font-playfair text-2xl font-bold text-alaska-dark">Charges fixes</h1>
        <p className="text-alaska-muted text-sm mt-1">Gestion et simulation d&apos;impact</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-white border border-alaska-sage-lt rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-[11px] text-alaska-muted uppercase tracking-wide">Total mensuel</p>
            <p className="text-2xl font-playfair font-bold text-orange-600">{formatMAD(totalActive)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border border-alaska-sage-lt rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-[11px] text-alaska-muted uppercase tracking-wide">Seuil rentabilité</p>
            <p className="text-2xl font-playfair font-bold text-alaska-dark">{formatMAD(breakeven)}</p>
          </CardContent>
        </Card>
      </div>

      <Button onClick={() => setShowSim(v => !v)} variant="outline"
        className="w-full gap-2 border-alaska-sage-lt text-alaska-dark hover:bg-alaska-sage-lt">
        <Zap size={16} className="text-alaska-sage"/>
        {showSim ? "Fermer le simulateur" : "Simuler un changement"}
      </Button>

      {showSim && (
        <Card className="bg-alaska-sage-lt border border-alaska-sage/30 rounded-xl">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-base text-alaska-dark">🔮 Simulateur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-alaska-dark mb-2">Ajouter un employé fictif :</p>
              <div className="flex gap-2">
                <Input type="number" value={simSalaire}
                  onChange={e => { setSimSalaire(+e.target.value); setSimExtra(+e.target.value) }}
                  className="flex-1 focus:ring-alaska-sage focus:border-alaska-sage"/>
                <span className="flex items-center text-sm text-alaska-muted">MAD/mois</span>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 space-y-2 border border-alaska-sage-lt">
              <div className="flex justify-between text-sm">
                <span className="text-alaska-muted">Charges actuelles</span>
                <span className="font-medium text-alaska-dark">{formatMAD(totalActive)}</span>
              </div>
              <div className="flex justify-between text-sm text-alaska-sage">
                <span>+ Simulation</span>
                <span className="font-medium">+{formatMAD(simExtra)}</span>
              </div>
              <div className="border-t border-alaska-sage-lt pt-2 flex justify-between font-bold">
                <span className="text-alaska-dark">Nouveau seuil</span>
                <span className="text-orange-600">{formatMAD(simulatedBreakeven)}</span>
              </div>
              <div className="flex justify-between text-xs text-alaska-muted">
                <span>Delta seuil</span><span>+{formatMAD(simulatedBreakeven - breakeven)}</span>
              </div>
            </div>
            <Button variant="outline" className="w-full text-xs border-alaska-sage-lt hover:bg-white"
              onClick={() => { setSimExtra(0); setSimSalaire(5000) }}>
              Réinitialiser
            </Button>
          </CardContent>
        </Card>
      )}

      {Object.entries(CAT_LABELS).map(([cat, label]) => {
        const items = byCategory[cat as keyof typeof byCategory] || []
        if (items.length === 0) return null
        const catTotal = items.reduce((s, c) => s + c.amount, 0)
        const maxAmt = Math.max(...items.map(c => c.amount), 1)
        return (
          <Card key={cat} className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-alaska-dark">{label}</CardTitle>
                <span className="text-sm font-playfair font-bold text-alaska-sage">{formatMAD(catTotal)}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {items.map(c => (
                <div key={c.id} className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-alaska-dark">{c.name}</p>
                      {c.payment_day && <p className="text-xs text-alaska-muted">{c.payment_day === 1 ? "1er" : `${c.payment_day}`} du mois</p>}
                    </div>
                    {editId === c.id ? (
                      <div className="flex gap-2">
                        <Input type="number" value={editVal} onChange={e => setEditVal(e.target.value)}
                          className="w-24 h-8 text-right text-sm focus:ring-alaska-sage focus:border-alaska-sage"/>
                        <Button size="sm" className="h-8 text-xs bg-alaska-sage hover:bg-alaska-sage/90" onClick={() => handleSave(c.id)}>OK</Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditId(null)}>✕</Button>
                      </div>
                    ) : (
                      <>
                        <span className="font-semibold text-sm text-alaska-dark">{formatMAD(c.amount)}</span>
                        <button onClick={() => { setEditId(c.id); setEditVal(String(c.amount)) }}
                          className="p-1.5 hover:bg-alaska-sage-lt rounded-md">
                          <Edit2 size={14} className="text-alaska-muted"/>
                        </button>
                        {c.is_staff && (
                          <button onClick={() => deactivateCharge(c.id)} className="p-1.5 hover:bg-red-50 text-red-400 rounded-md">
                            <UserX size={14}/>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="w-full bg-alaska-sage-lt rounded-full h-1">
                    <div className="h-1 rounded-full bg-alaska-sage transition-all duration-500"
                      style={{ width: `${(c.amount / maxAmt) * 100}%` }}/>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
