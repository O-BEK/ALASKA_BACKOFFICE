# Saisie Refonte — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refaire le module `/saisie` dans `claude/` — solde caisse en temps réel, postes MP alignés sur l'Excel, Othman dans le personnel, grille semaine éditable sur desktop.

**Architecture:** Projet `claude/` — localStorage via `saveLocalEntry`/`getLocalEntry`, hooks existants `useDailyEntry` + `useWeekView`, nouveau `useWeekEntries` pour la grille éditable. Pas de Supabase, pas d'API routes.

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind, shadcn/ui, date-fns, localStorage

**Important:** Tous les chemins sont relatifs à `claude/`. Ne jamais remonter au dossier parent.

---

## File Map

| Fichier | Action |
|---|---|
| `lib/mock-data.ts` | Modifier — ajouter Othman au FIXED_CHARGES |
| `app/(dashboard)/saisie/page.tsx` | Modifier — fix postes MP, solde caisse, grille desktop |
| `lib/hooks/useWeekEntries.ts` | Créer — hook mutable pour la grille semaine |
| `components/saisie/WeekGrid.tsx` | Créer — grille éditable 7 colonnes |

---

## Task 1: Ajouter Othman au personnel + aligner postes MP

**Files:**
- Modify: `lib/mock-data.ts`
- Modify: `app/(dashboard)/saisie/page.tsx`

- [ ] **Ajouter Othman dans `lib/mock-data.ts`**

Trouver le tableau `FIXED_CHARGES` et ajouter Othman en premier (Boss) :

```typescript
{ id: "fc0",  name: "Othman",      category: "PERSONNEL",  amount: 0,     type: "semi-fixed", payment_day: null, is_staff: true,  is_active: true, start_date: "2024-10-01", end_date: null },
```

L'insérer avant `fc7` (Ramzi).

- [ ] **Corriger `MP_POSTES` dans `app/(dashboard)/saisie/page.tsx`**

Remplacer :
```typescript
const MP_POSTES = ["Poissonnier","Boucher","Poulet","Courses / Marché","Eau","Technicien","Autre MP"]
```

Par :
```typescript
const MP_POSTES = ["Poissonnier","Boucher","Poulet","Eau","Technicien"]
```

- [ ] **Vérifier dans le navigateur**

`npm run dev` → `/saisie` → section Matières Premières doit afficher les 5 postes. Section Personnel doit afficher Othman en premier.

- [ ] **Commit**

```bash
git add lib/mock-data.ts app/\(dashboard\)/saisie/page.tsx
git commit -m "fix(saisie): aligner postes MP avec Excel + ajouter Othman au personnel"
```

---

## Task 2: Remplacer "Marge nette" par "Solde caisse" dans le récap

**Files:**
- Modify: `app/(dashboard)/saisie/page.tsx`

Le solde caisse = argent physiquement disponible après les dépenses du jour. C'est ce que l'utilisateur veut savoir.

- [ ] **Remplacer le calcul et l'affichage dans `app/(dashboard)/saisie/page.tsx`**

Remplacer ces lignes (dans la section TAB SAISIE, Card récap) :

```typescript
const marge = calcNetMargin(entry.ca_caisse, totalExpenses)
const tauxMarge = calcMarginRate(marge, entry.ca_caisse)
```

Par :
```typescript
const soldeCaisse = entry.ca_caisse - totalExpenses
```

Remplacer le contenu de la `Card` récap (bg-[#1F3864]) par :

```typescript
<Card className="bg-[#1F3864] text-white">
  <CardContent className="pt-4 pb-4 space-y-2">
    <div className="flex justify-between text-sm">
      <span className="text-blue-200">CA Caisse</span>
      <span className="font-semibold">{formatMAD(entry.ca_caisse)}</span>
    </div>
    <div className="flex justify-between text-sm">
      <span className="text-blue-200">Total sorties</span>
      <span className="font-semibold text-orange-300">-{formatMAD(totalExpenses)}</span>
    </div>
    <div className="border-t border-white/20 pt-2 flex justify-between font-bold text-base">
      <span>💵 Solde caisse</span>
      <span className={soldeCaisse >= 0 ? "text-green-300" : "text-red-400"}>
        {formatMAD(Math.abs(soldeCaisse))}
        {soldeCaisse < 0 && " ⚠"}
      </span>
    </div>
    <Button onClick={save} className="w-full mt-3 bg-white text-[#1F3864] hover:bg-blue-50 font-semibold">
      {saved ? <><CheckCircle2 size={16} className="mr-2"/>Enregistré</> : <><Save size={16} className="mr-2"/>Enregistrer</>}
    </Button>
    {!saved && <p className="text-center text-xs text-blue-200 flex items-center justify-center gap-1"><Clock size={10}/>Sauvegarde auto dans 2s</p>}
  </CardContent>
</Card>
```

Supprimer aussi les imports inutilisés `calcNetMargin` et `calcMarginRate` si plus utilisés dans ce fichier.

- [ ] **Vérifier**

Saisir un CA de 3000 et des dépenses de 1200 → le solde doit afficher `1 800 MAD` en vert. Saisir des dépenses > CA → solde rouge avec `⚠`.

- [ ] **Commit**

```bash
git add app/\(dashboard\)/saisie/page.tsx
git commit -m "feat(saisie): remplacer marge nette par solde caisse dans le récap"
```

---

## Task 3: Hook useWeekEntries (grille éditable)

**Files:**
- Create: `lib/hooks/useWeekEntries.ts`

Ce hook charge les 7 entrées d'une semaine en état mutable et expose `updateCell(date, category, label, amount)` pour l'édition inline.

- [ ] **Créer `lib/hooks/useWeekEntries.ts`**

```typescript
// lib/hooks/useWeekEntries.ts
"use client"
import { useState, useEffect } from "react"
import { format, addDays } from "date-fns"
import { DailyEntry, ExpenseItem } from "@/lib/types"
import { getLocalEntry, saveLocalEntry } from "@/lib/local-store"
import { getMockDailyEntry } from "@/lib/mock-data"

function loadEntry(date: string): DailyEntry {
  return getLocalEntry(date) || getMockDailyEntry(date) || {
    date, ca_caisse: 0, ca_b2b: 0, ca_soir: 0, pct_soir: 0,
    tickets_count: 0, notes: "", source: "manual", expenses: []
  }
}

export function useWeekEntries(weekStart: Date) {
  const dates = Array.from({ length: 7 }, (_, i) =>
    format(addDays(weekStart, i), "yyyy-MM-dd")
  )

  const [entries, setEntries] = useState<Record<string, DailyEntry>>(() =>
    Object.fromEntries(dates.map(d => [d, loadEntry(d)]))
  )

  // Recharger quand la semaine change
  useEffect(() => {
    setEntries(Object.fromEntries(dates.map(d => [d, loadEntry(d)])))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.getTime()])

  /** Met à jour le CA d'un jour */
  const updateCA = (date: string, ca: number) => {
    setEntries(prev => {
      const updated = { ...prev[date], ca_caisse: Math.max(0, ca) }
      saveLocalEntry(updated)
      return { ...prev, [date]: updated }
    })
  }

  /** Met à jour (ou supprime si amount=0) une dépense dans un jour */
  const updateExpense = (date: string, category: "MP" | "RH" | "CHARGES" | "AUTRE", label: string, amount: number) => {
    setEntries(prev => {
      const entry = prev[date]
      const others = entry.expenses.filter(e => !(e.category === category && e.label === label))
      const expenses: ExpenseItem[] = amount > 0
        ? [...others, { id: `${category}-${label}-${date}`, category, label, amount }]
        : others
      const updated = { ...entry, expenses }
      saveLocalEntry(updated)
      return { ...prev, [date]: updated }
    })
  }

  return { entries, dates, updateCA, updateExpense }
}
```

- [ ] **Commit**

```bash
git add lib/hooks/useWeekEntries.ts
git commit -m "feat(saisie): hook useWeekEntries pour la grille éditable"
```

---

## Task 4: Composant WeekGrid (grille éditable desktop)

**Files:**
- Create: `components/saisie/WeekGrid.tsx`

- [ ] **Créer `components/saisie/WeekGrid.tsx`**

```typescript
// components/saisie/WeekGrid.tsx
"use client"
import { useState, useRef } from "react"
import { format, isAfter, startOfDay, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { Plus } from "lucide-react"
import { DailyEntry } from "@/lib/types"
import { FIXED_CHARGES } from "@/lib/mock-data"
import { formatMAD } from "@/lib/utils"

const MP_POSTES = ["Poissonnier","Boucher","Poulet","Eau","Technicien"]
const today = startOfDay(new Date())

interface WeekGridProps {
  entries: Record<string, DailyEntry>
  dates: string[]
  onUpdateCA: (date: string, ca: number) => void
  onUpdateExpense: (date: string, category: "MP" | "RH" | "CHARGES" | "AUTRE", label: string, amount: number) => void
}

/** Cellule inline éditable */
function Cell({
  value,
  disabled,
  onChange,
}: {
  value: number
  disabled?: boolean
  onChange: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const ref = useRef<HTMLInputElement>(null)

  if (disabled) {
    return <div className="text-right text-sm px-2 py-1 text-gray-300">—</div>
  }

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        min={0}
        value={draft}
        autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); onChange(Number(draft) || 0) }}
        onKeyDown={e => { if (e.key === "Enter" || e.key === "Tab") { setEditing(false); onChange(Number(draft) || 0) } }}
        className="w-full text-right text-sm px-1 py-0.5 border border-blue-400 rounded outline-none bg-white"
      />
    )
  }

  return (
    <div
      onClick={() => { setDraft(value === 0 ? "" : String(value)); setEditing(true) }}
      className={`text-right text-sm px-2 py-1 rounded cursor-pointer hover:bg-blue-50 select-none ${
        value === 0 ? "text-gray-300" : "text-gray-900 font-medium"
      }`}
    >
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

  const totalSorties = (date: string) =>
    entries[date]?.expenses.reduce((s, e) => s + e.amount, 0) ?? 0
  const solde = (date: string) => getCA(date) - totalSorties(date)

  const weekCA = dates.reduce((s, d) => s + getCA(d), 0)
  const weekSorties = dates.reduce((s, d) => s + totalSorties(d), 0)
  const weekSolde = weekCA - weekSorties

  const thClass = "text-center px-2 py-2 text-xs font-semibold capitalize"
  const tdClass = "px-1 py-0.5"

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b-2 border-gray-200">
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 w-44">Poste</th>
            {dates.map(d => {
              const isFuture = isAfter(parseISO(d), today)
              return (
                <th key={d} className={`${thClass} min-w-[88px] ${isFuture ? "text-gray-300" : "text-gray-700"}`}>
                  {format(parseISO(d), "EEE dd/MM", { locale: fr })}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {/* CA Caisse */}
          <tr className="bg-blue-50/50 border-b border-gray-200">
            <td className="px-3 py-1.5 text-xs font-bold text-blue-800">💰 CA Caisse</td>
            {dates.map(d => (
              <td key={d} className={tdClass}>
                <Cell
                  value={getCA(d)}
                  disabled={isAfter(parseISO(d), today) || entries[d]?.source === "csv_import"}
                  onChange={v => onUpdateCA(d, v)}
                />
              </td>
            ))}
          </tr>

          {/* MP */}
          <tr className="bg-orange-50/40">
            <td colSpan={8} className="px-3 py-1 text-xs font-bold text-orange-700">🥩 Matières Premières</td>
          </tr>
          {MP_POSTES.map(label => (
            <tr key={label} className="border-t border-gray-100 hover:bg-gray-50/50">
              <td className="px-3 py-1.5 text-xs text-gray-600 pl-6">{label}</td>
              {dates.map(d => (
                <td key={d} className={tdClass}>
                  <Cell
                    value={getExp(d, "MP", label)}
                    disabled={isAfter(parseISO(d), today)}
                    onChange={v => onUpdateExpense(d, "MP", label, v)}
                  />
                </td>
              ))}
            </tr>
          ))}

          {/* Personnel */}
          <tr className="bg-purple-50/40">
            <td colSpan={8} className="px-3 py-1 text-xs font-bold text-purple-700">👥 Personnel</td>
          </tr>
          {staff.map(emp => (
            <tr key={emp.id} className="border-t border-gray-100 hover:bg-gray-50/50">
              <td className="px-3 py-1.5 text-xs text-gray-600 pl-6">{emp.name}</td>
              {dates.map(d => (
                <td key={d} className={tdClass}>
                  <Cell
                    value={getExp(d, "RH", emp.name)}
                    disabled={isAfter(parseISO(d), today)}
                    onChange={v => onUpdateExpense(d, "RH", emp.name, v)}
                  />
                </td>
              ))}
            </tr>
          ))}

          {/* Autre */}
          <tr className="bg-gray-50/60">
            <td className="px-3 py-1 text-xs font-bold text-gray-600 flex items-center gap-2">
              📦 Autre
              <button
                onClick={() => setAutreLabels(l => [...l, ""])}
                className="ml-1 text-blue-500 hover:text-blue-700"
              >
                <Plus size={12} />
              </button>
            </td>
            <td colSpan={7} />
          </tr>
          {autreLabels.map((lbl, idx) => (
            <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50/50">
              <td className="px-3 py-1 pl-6">
                <input
                  className="text-xs border rounded px-1 py-0.5 w-full"
                  placeholder="Libellé..."
                  value={lbl}
                  onChange={e => setAutreLabels(l => l.map((x, i) => i === idx ? e.target.value : x))}
                />
              </td>
              {dates.map(d => (
                <td key={d} className={tdClass}>
                  <Cell
                    value={lbl ? getExp(d, "AUTRE", lbl) : 0}
                    disabled={isAfter(parseISO(d), today) || !lbl}
                    onChange={v => lbl && onUpdateExpense(d, "AUTRE", lbl, v)}
                  />
                </td>
              ))}
            </tr>
          ))}

          {/* Total sorties */}
          <tr className="border-t-2 border-gray-300 bg-gray-50">
            <td className="px-3 py-2 text-xs font-bold text-gray-700">Total sorties</td>
            {dates.map(d => (
              <td key={d} className="px-2 py-2 text-right text-xs font-semibold text-orange-700">
                {totalSorties(d) > 0 ? totalSorties(d).toLocaleString("fr-MA") : "—"}
              </td>
            ))}
          </tr>

          {/* Solde caisse */}
          <tr className="border-t border-gray-200">
            <td className="px-3 py-2 text-xs font-bold">💵 Solde caisse</td>
            {dates.map(d => {
              const s = solde(d)
              const isEmpty = getCA(d) === 0 && totalSorties(d) === 0
              return (
                <td key={d} className={`px-2 py-2 text-right text-xs font-bold ${
                  isEmpty ? "text-gray-300" : s < 0 ? "text-red-600" : "text-green-700"
                }`}>
                  {isEmpty ? "—" : s.toLocaleString("fr-MA")}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>

      {/* Résumé semaine */}
      <div className="mt-3 flex flex-wrap gap-4 text-sm px-3 py-2 bg-[#1F3864]/5 rounded-lg border border-[#1F3864]/10">
        <span className="text-gray-600">CA semaine : <strong>{formatMAD(weekCA)}</strong></span>
        <span className="text-gray-600">Sorties : <strong className="text-orange-600">{formatMAD(weekSorties)}</strong></span>
        <span className="text-gray-600">
          Solde :{" "}
          <strong className={weekSolde < 0 ? "text-red-600" : "text-green-700"}>
            {formatMAD(weekSolde)}
          </strong>
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add components/saisie/WeekGrid.tsx
git commit -m "feat(saisie): composant WeekGrid éditable desktop"
```

---

## Task 5: Intégrer WeekGrid dans la page saisie (desktop)

**Files:**
- Modify: `app/(dashboard)/saisie/page.tsx`

Sur desktop, l'onglet "Semaine" affiche la grille éditable. Sur mobile, il garde la liste actuelle (lecture seule avec clic pour aller sur le jour).

- [ ] **Ajouter l'import du hook et du composant dans `app/(dashboard)/saisie/page.tsx`**

Ajouter en haut du fichier :

```typescript
import { useWeekEntries } from "@/lib/hooks/useWeekEntries"
import { WeekGrid } from "@/components/saisie/WeekGrid"
```

- [ ] **Ajouter l'initialisation du hook dans le composant**

Ajouter après les autres `useState`/hooks existants :

```typescript
const { entries: weekEntries, dates: weekDates, updateCA: updateWeekCA, updateExpense: updateWeekExpense } = useWeekEntries(weekStart)
```

- [ ] **Remplacer le contenu de l'onglet "Semaine" dans le JSX**

Trouver le bloc `{tab === "Semaine" && (` et remplacer son contenu interne par :

```typescript
{tab === "Semaine" && (
  <div className="space-y-4">
    <div className="flex items-center justify-between bg-white border rounded-lg p-3">
      <button onClick={() => setWeekStart(w => subWeeks(w, 1))} className="p-1 hover:bg-gray-100 rounded transition">
        <ChevronLeft size={18}/>
      </button>
      <p className="text-sm font-semibold text-gray-700">
        {format(weekStart, "d MMM", { locale: fr })} – {format(addDays(weekStart, 6), "d MMM yyyy", { locale: fr })}
      </p>
      <button onClick={() => setWeekStart(w => addWeeks(w, 1))} className="p-1 hover:bg-gray-100 rounded transition">
        <ChevronRight size={18}/>
      </button>
    </div>

    {/* Desktop : grille éditable */}
    <div className="hidden md:block bg-white border rounded-xl p-4">
      <WeekGrid
        entries={weekEntries}
        dates={weekDates}
        onUpdateCA={updateWeekCA}
        onUpdateExpense={updateWeekExpense}
      />
    </div>

    {/* Mobile : liste lecture seule (inchangée) */}
    <div className="md:hidden space-y-4">
      {/* KPIs semaine */}
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="pt-4 pb-4">
          <p className="text-xs text-gray-500">CA semaine</p>
          <p className="text-xl font-bold">{formatMAD(weekData.totalCA)}</p>
          <p className="text-xs text-gray-400">{weekData.pctBreakeven.toFixed(0)}% du seuil hebdo</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4">
          <p className="text-xs text-gray-500">Dépenses</p>
          <p className="text-xl font-bold text-orange-600">{formatMAD(weekData.totalDep)}</p>
          <p className="text-xs text-gray-400">Solde : {formatMAD(weekData.totalCA - weekData.totalDep)}</p>
        </CardContent></Card>
      </div>
      {/* Jours cliquables */}
      <Card>
        <CardContent className="pt-4 pb-2 space-y-2">
          {weekData.days.map(day => (
            <button key={day.date} onClick={() => { setDate(new Date(day.date)); setTab("Saisie") }}
              className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-blue-50 rounded-lg transition text-left">
              <div className="flex items-center gap-3">
                <span className="text-sm">{day.status === "full" ? "✅" : day.status === "partial" ? "🟡" : "⬜"}</span>
                <span className="text-sm font-medium capitalize">{day.label}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{day.entry ? formatMAD(day.entry.ca_caisse) : "—"}</p>
                {day.totalExpenses > 0 && <p className="text-xs text-gray-400">Dép: {formatMAD(day.totalExpenses)}</p>}
              </div>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  </div>
)}
```

- [ ] **Vérifier (desktop — fenêtre > 768px)**

- Onglet Semaine → grille avec 7 colonnes visible
- Clic sur cellule CA d'un jour → input apparaît, saisie possible
- Blur → valeur sauvegardée dans localStorage
- Passer sur mobile (DevTools 390px) → liste cliquable apparaît, grille masquée

- [ ] **Vérifier (mobile)**

- Onglet Saisie : solder caisse affiché en bas au lieu de marge nette
- Onglet Semaine : liste des jours cliquable, "Solde" dans les KPIs

- [ ] **Lancer le lint**

```bash
npm run lint
```

Corriger les imports inutilisés (notamment `calcNetMargin`, `calcMarginRate` si plus utilisés ailleurs dans le fichier).

- [ ] **Commit final**

```bash
git add app/\(dashboard\)/saisie/page.tsx
git commit -m "feat(saisie): grille semaine éditable desktop + solde caisse mobile"
```
