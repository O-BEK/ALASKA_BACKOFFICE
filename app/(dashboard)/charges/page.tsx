"use client"
import { useState } from "react"
import { useCharges } from "@/lib/hooks/useCharges"
import { formatMAD } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Edit2, UserX, Zap, Plus, X } from "lucide-react"
import { useExpenseTemplates } from "@/lib/hooks/useExpenseTemplates"

const CAT_LABELS: Record<string, string> = {
  IMMOBILIER: "🏠 Immobilier", PERSONNEL: "👥 Personnel",
  ENERGIE: "⚡ Énergie", TELECOM: "📡 Télécom", DIVERS: "📦 Divers",
}

export default function ChargesPage() {
  const { byCategory, totalActive, breakeven, simExtra, setSimExtra, simulatedBreakeven, updateCharge, deactivateCharge, createCharge } = useCharges()
  const [editId, setEditId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState("")
  const [showSim, setShowSim] = useState(false)
  const [simSalaire, setSimSalaire] = useState(5000)

  const [addingCat, setAddingCat] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newAmount, setNewAmount] = useState("")
  const [newType, setNewType] = useState<"fixed" | "variable" | "semi-fixed">("fixed")
  const [newPayDay, setNewPayDay] = useState("")
  const [addingNew, setAddingNew] = useState(false)
  const [newCatName, setNewCatName] = useState("")

  const { sections, createSection, createItem, deleteSection, deleteItem } = useExpenseTemplates()
  const [addingItemSectionId, setAddingItemSectionId] = useState<string | null>(null)
  const [newItemLabel, setNewItemLabel] = useState("")
  const [addingNewSection, setAddingNewSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState("")
  const [newSectionEmoji, setNewSectionEmoji] = useState("📦")
  const [newSectionCategory, setNewSectionCategory] = useState<"MP" | "CHARGES" | "AUTRE">("AUTRE")

  const resetAddForm = () => {
    setNewName(""); setNewAmount(""); setNewType("fixed"); setNewPayDay(""); setAddingCat(null)
  }

  const handleCreate = async (cat: string) => {
    if (!newName || !newAmount) return
    await createCharge({
      name: newName,
      category: cat,
      amount: parseFloat(newAmount) || 0,
      type: newType,
      payment_day: newPayDay ? parseInt(newPayDay) : null,
      is_staff: cat === "PERSONNEL",
    })
    resetAddForm()
  }

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

      {[
        ...Object.entries(CAT_LABELS),
        ...Object.keys(byCategory).filter(k => !(k in CAT_LABELS)).map(k => [k, `📌 ${k}`] as [string, string]),
      ].map(([cat, label]) => {
        const items = byCategory[cat as keyof typeof byCategory] || []
        if (items.length === 0 && addingCat !== cat) return null
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

              {/* Inline add form or add button */}
              {addingCat === cat ? (
                <div className="mt-3 pt-3 border-t border-alaska-sage-lt space-y-2">
                  <Input
                    placeholder={cat === "PERSONNEL" ? "Nom du salarié" : "Libellé"}
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Montant MAD"
                      value={newAmount}
                      onChange={e => setNewAmount(e.target.value)}
                      className="flex-1 h-8 text-sm"
                    />
                    <Input
                      type="number"
                      placeholder="Jour"
                      value={newPayDay}
                      onChange={e => setNewPayDay(e.target.value)}
                      className="w-16 h-8 text-sm"
                      min={1}
                      max={31}
                    />
                  </div>
                  {cat !== "PERSONNEL" && (
                    <select
                      value={newType}
                      onChange={e => setNewType(e.target.value as "fixed" | "variable" | "semi-fixed")}
                      className="w-full h-8 text-sm border border-input rounded-md px-2 bg-background"
                    >
                      <option value="fixed">Fixe</option>
                      <option value="variable">Variable</option>
                      <option value="semi-fixed">Semi-fixe</option>
                    </select>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-8 text-xs bg-alaska-sage hover:bg-alaska-sage/90" onClick={() => handleCreate(cat)}>
                      Créer
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={resetAddForm}>
                      <X size={14}/>
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingCat(cat)}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-alaska-muted border border-dashed border-alaska-sage-lt rounded-lg hover:bg-alaska-sage-lt/50 hover:text-alaska-sage transition"
                >
                  <Plus size={12}/> Ajouter {cat === "PERSONNEL" ? "un salarié" : "une charge"}
                </button>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* ── Modèles de saisie journalière ─────────────────────── */}
      <div className="pt-4">
        <h2 className="font-playfair text-lg font-bold text-alaska-dark mb-1">Modèles de saisie</h2>
        <p className="text-alaska-muted text-xs mb-4">Items proposés lors de la saisie quotidienne</p>
      </div>

      {sections.map(section => (
        <Card key={section.id} className="bg-white border border-alaska-sage-lt rounded-xl">
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-alaska-dark">
                {section.emoji} {section.name}
                <span className="ml-2 text-xs font-normal text-alaska-muted px-1.5 py-0.5 bg-alaska-sage-lt rounded">
                  {section.expense_category}
                </span>
              </CardTitle>
              <button onClick={() => deleteSection(section.id)}
                className="p-1.5 hover:bg-red-50 text-red-400 rounded-md">
                <X size={14}/>
              </button>
            </div>
          </CardHeader>
          <CardContent className="pb-4 space-y-2">
            {section.items.map(item => (
              <div key={item.id} className="flex items-center justify-between py-1 border-b border-alaska-sage-lt/50 last:border-0">
                <span className="text-sm text-alaska-dark">{item.label}</span>
                <button onClick={() => deleteItem(item.id)}
                  className="p-1 hover:bg-red-50 text-red-400 rounded">
                  <X size={12}/>
                </button>
              </div>
            ))}

            {addingItemSectionId === section.id ? (
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="Libellé (ex: Légumes)"
                  value={newItemLabel}
                  onChange={e => setNewItemLabel(e.target.value)}
                  className="h-8 text-sm flex-1"
                  autoFocus
                />
                <Button size="sm" className="h-8 text-xs bg-alaska-sage hover:bg-alaska-sage/90"
                  onClick={async () => {
                    if (!newItemLabel.trim()) return
                    await createItem(section.id, newItemLabel.trim())
                    setNewItemLabel("")
                    setAddingItemSectionId(null)
                  }}>
                  OK
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs"
                  onClick={() => { setAddingItemSectionId(null); setNewItemLabel("") }}>
                  <X size={14}/>
                </Button>
              </div>
            ) : (
              <button onClick={() => setAddingItemSectionId(section.id)}
                className="mt-1 w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-alaska-muted border border-dashed border-alaska-sage-lt rounded-lg hover:bg-alaska-sage-lt/50 hover:text-alaska-sage transition">
                <Plus size={12}/> Ajouter un item
              </button>
            )}
          </CardContent>
        </Card>
      ))}

      {addingNewSection ? (
        <Card className="bg-white border border-dashed border-alaska-sage rounded-xl">
          <CardContent className="pt-4 pb-4 space-y-2">
            <div className="flex gap-2">
              <Input placeholder="Emoji" value={newSectionEmoji}
                onChange={e => setNewSectionEmoji(e.target.value)}
                className="w-16 h-8 text-sm text-center"/>
              <Input placeholder="Nom de la section (ex: Boissons)" value={newSectionName}
                onChange={e => setNewSectionName(e.target.value)}
                className="flex-1 h-8 text-sm" autoFocus/>
            </div>
            <select value={newSectionCategory}
              onChange={e => setNewSectionCategory(e.target.value as "MP" | "CHARGES" | "AUTRE")}
              className="w-full h-8 text-sm border border-input rounded-md px-2 bg-background">
              <option value="MP">MP — Matières Premières</option>
              <option value="CHARGES">CHARGES — Autres charges</option>
              <option value="AUTRE">AUTRE — Divers</option>
            </select>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-8 text-xs bg-alaska-sage hover:bg-alaska-sage/90"
                onClick={async () => {
                  if (!newSectionName.trim()) return
                  await createSection({ name: newSectionName.trim(), emoji: newSectionEmoji, expense_category: newSectionCategory })
                  setNewSectionName(""); setNewSectionEmoji("📦"); setAddingNewSection(false)
                }}>
                Créer la section
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs"
                onClick={() => { setAddingNewSection(false); setNewSectionName(""); setNewSectionEmoji("📦") }}>
                <X size={14}/>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <button onClick={() => setAddingNewSection(true)}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-alaska-muted border border-dashed border-alaska-sage-lt rounded-xl hover:bg-alaska-sage-lt/50 hover:text-alaska-sage transition">
          <Plus size={14}/> Nouvelle section de saisie
        </button>
      )}

      {addingNew ? (
        <Card className="bg-white border border-dashed border-alaska-sage rounded-xl">
          <CardContent className="pt-4 pb-4 space-y-2">
            <Input
              placeholder="Nom de la catégorie (ex: ASSURANCES)"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value.toUpperCase())}
              className="h-8 text-sm"
            />
            <Input placeholder="Libellé" value={newName} onChange={e => setNewName(e.target.value)} className="h-8 text-sm"/>
            <div className="flex gap-2">
              <Input type="number" placeholder="Montant MAD" value={newAmount} onChange={e => setNewAmount(e.target.value)} className="flex-1 h-8 text-sm"/>
              <Input type="number" placeholder="Jour" value={newPayDay} onChange={e => setNewPayDay(e.target.value)} className="w-16 h-8 text-sm" min={1} max={31}/>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-8 text-xs bg-alaska-sage hover:bg-alaska-sage/90"
                onClick={async () => {
                  if (!newCatName || !newName || !newAmount) return
                  await handleCreate(newCatName)
                  setAddingNew(false)
                  setNewCatName("")
                }}>
                Créer
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAddingNew(false); resetAddForm() }}>
                <X size={14}/>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <button
          onClick={() => setAddingNew(true)}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-alaska-muted border border-dashed border-alaska-sage-lt rounded-xl hover:bg-alaska-sage-lt/50 hover:text-alaska-sage transition"
        >
          <Plus size={14}/> Nouvelle catégorie
        </button>
      )}
    </div>
  )
}
