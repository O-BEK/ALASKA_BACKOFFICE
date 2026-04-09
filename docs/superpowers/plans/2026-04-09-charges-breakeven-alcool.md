# Charges dynamiques, Breakeven temps réel & Licence alcool — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le seuil de rentabilité dynamique (depuis les vraies charges Supabase), permettre l'ajout de charges/salariés dans l'UI, et implémenter la licence alcool avec impact automatique sur les objectifs futurs.

**Architecture:** Le breakeven est calculé à la volée depuis `db.fixed_charges` dans `analytics.ts` au lieu d'une constante hardcodée. Les nouvelles charges sont créées via `POST /api/charges`. La validation de la licence alcool appelle `POST /api/objectives/alcool-validate` qui met à jour `monthly_objectives` pour les mois futurs.

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL + RLS), TypeScript, Zod, Vitest, Tailwind CSS

---

## File Map

| Fichier | Action | Rôle |
|---|---|---|
| `lib/server/analytics.ts` | Modifier | Remplacer constante BREAKEVEN par calcul dynamique |
| `lib/server/supabase-store.ts` | Modifier | Ajouter `createFixedCharge()` et `applyAlcoolLicenseUplift()` |
| `app/api/charges/route.ts` | Modifier | Ajouter handler POST |
| `lib/hooks/useCharges.ts` | Modifier | Ajouter `createCharge()` |
| `app/(dashboard)/charges/page.tsx` | Modifier | Formulaire inline d'ajout par catégorie |
| `app/(dashboard)/objectifs/page.tsx` | Modifier | Dialogue de validation licence alcool |
| `app/api/objectives/alcool-validate/route.ts` | Créer | Route POST pour appliquer l'uplift |
| `lib/types.ts` | Modifier | Étendre `FixedCharge.category` |
| `lib/contracts.ts` | Modifier | Étendre schema Zod charges + ajouter parseAlcoolValidatePayload |
| `tests/calculations.test.ts` | Modifier | Test breakeven dynamique |

---

## Task 1 : Breakeven dynamique dans analytics.ts

**Files:**
- Modify: `lib/server/analytics.ts`
- Modify: `tests/calculations.test.ts`

- [ ] **Step 1.1 : Écrire le test qui échoue**

Dans `tests/calculations.test.ts`, ajouter :

```ts
import { calcBreakeven } from "../lib/calculations"

it("calculates dynamic breakeven from charges array", () => {
  const charges = [
    { is_active: true, amount: 34000 },
    { is_active: true, amount: 6000 },
    { is_active: false, amount: 99999 }, // ignoré
  ]
  const total = charges.filter(c => c.is_active).reduce((s, c) => s + c.amount, 0)
  expect(calcBreakeven(total)).toBeCloseTo(55555.6, 0)
})
```

- [ ] **Step 1.2 : Lancer le test pour vérifier qu'il passe déjà**

```bash
cd "C:/Users/OthmanBEKRI/OneDrive - UTM/09 - KAYZARAN/10.ALASKA-PILOT/claude"
npm run test -- --reporter=verbose 2>&1 | tail -20
```

Expected : PASS (calcBreakeven existe déjà, le test est juste un garde-fou)

- [ ] **Step 1.3 : Remplacer BREAKEVEN par calcul dynamique dans analytics.ts**

En haut de `lib/server/analytics.ts`, après les imports existants, ajouter la fonction helper :

```ts
function liveBreakeven(db: PilotDb): number {
  const total = db.fixed_charges
    .filter((c) => c.is_active)
    .reduce((sum, c) => sum + c.amount, 0)
  return total > 0 ? calcBreakeven(total) : BREAKEVEN
}
```

Remplacer dans `buildMonthlyKpis` (ligne ~44) :
```ts
// AVANT
const pct_breakeven = calcBreakevenPct(ca_caisse, BREAKEVEN)
// ...
breakeven: BREAKEVEN,

// APRÈS
const breakeven = liveBreakeven(db)
const pct_breakeven = calcBreakevenPct(ca_caisse, breakeven)
// ...
breakeven,
```

Remplacer dans `buildDashboardData` (ligne ~78) :
```ts
// AVANT
breakeven: BREAKEVEN,

// APRÈS
breakeven: liveBreakeven(db),
```

Remplacer dans `buildWeekData` (ligne ~134) :
```ts
// AVANT
const weeklyBreakeven = getWeeklyBreakeven()

// APRÈS
const weeklyBreakeven = liveBreakeven(db) / 4.33
```

- [ ] **Step 1.4 : Ajouter l'import manquant dans analytics.ts**

Vérifier que `BREAKEVEN` et `calcBreakeven` sont tous les deux importés depuis `@/lib/calculations` (BREAKEVEN sert de fallback si fixed_charges est vide) :

```ts
import { BREAKEVEN, calcBreakeven, calcBreakevenPct, calcMarginRate, calcNetMargin } from "@/lib/calculations"
```

- [ ] **Step 1.5 : Lancer les tests et le build**

```bash
npm run test 2>&1 | tail -10
npm run build 2>&1 | tail -20
```

Expected : tous les tests passent, build OK.

- [ ] **Step 1.6 : Commit**

```bash
git add lib/server/analytics.ts tests/calculations.test.ts
git commit -m "fix: use live fixed_charges sum for breakeven in analytics"
```

---

## Task 2 : Seed action item licence alcool + migration metadata

**Files:**
- DB via MCP Supabase

- [ ] **Step 2.1 : Insérer l'action item licence alcool en base**

Via MCP `execute_sql` sur project `vwecauqzjtclaqkodzro` :

```sql
INSERT INTO action_items (lever, title, description, priority, deadline, impact, status, sort_order)
VALUES (
  'pilotage',
  'Obtenir la licence d''alcool',
  'Démarches administratives auprès de la Wilaya de Rabat. Tournant majeur : ticket moyen estimé à 250 MAD (+47% vs 170 MAD actuel).',
  'urgent',
  'T3 2026',
  'Ticket moyen 170 → 250 MAD (+47%) · CA annuel projeté +40%',
  'todo',
  0
)
ON CONFLICT DO NOTHING;

-- Remettre les autres actions en sort_order 1+
UPDATE action_items SET sort_order = sort_order + 1
WHERE title != 'Obtenir la licence d''alcool';
```

- [ ] **Step 2.2 : Ajouter colonne metadata sur action_items**

Via MCP `apply_migration` :

```sql
ALTER TABLE action_items
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;
```

- [ ] **Step 2.3 : Vérifier en base**

```sql
SELECT id, title, sort_order, status, metadata
FROM action_items
ORDER BY sort_order
LIMIT 5;
```

Expected : "Obtenir la licence d'alcool" en premier avec sort_order=0.

---

## Task 3 : POST /api/charges + createFixedCharge()

**Files:**
- Modify: `lib/server/supabase-store.ts`
- Modify: `app/api/charges/route.ts`
- Modify: `lib/types.ts`
- Modify: `lib/contracts.ts`

- [ ] **Step 3.1 : Étendre le type FixedCharge dans lib/types.ts**

Remplacer la ligne `category` dans `FixedCharge` :

```ts
// AVANT
category: "IMMOBILIER" | "PERSONNEL" | "ENERGIE" | "TELECOM" | "DIVERS"

// APRÈS
category: "IMMOBILIER" | "PERSONNEL" | "ENERGIE" | "TELECOM" | "DIVERS" | string
```

- [ ] **Step 3.2 : Étendre le schema Zod dans lib/contracts.ts**

Dans `parseChargesPayload`, remplacer le validator de `category` :

```ts
// AVANT
category: z.enum(["IMMOBILIER", "PERSONNEL", "ENERGIE", "TELECOM", "DIVERS"]).catch("DIVERS"),

// APRÈS
category: z.string().catch("DIVERS"),
```

Ajouter aussi un nouveau parser à la fin du fichier :

```ts
export function parseCreateChargeBody(input: unknown): {
  name: string
  category: string
  amount: number
  type: "fixed" | "variable" | "semi-fixed"
  payment_day: number | null
  is_staff: boolean
} {
  return z.object({
    name: z.string().min(1),
    category: z.string().min(1),
    amount: z.coerce.number().min(0),
    type: z.enum(["fixed", "variable", "semi-fixed"]).default("fixed"),
    payment_day: z.coerce.number().nullable().default(null),
    is_staff: z.coerce.boolean().default(false),
  }).parse(input)
}
```

- [ ] **Step 3.3 : Ajouter createFixedCharge() dans supabase-store.ts**

Après `updateFixedCharge`, ajouter :

```ts
export async function createFixedCharge(
  client: SupabaseClientLike,
  payload: {
    name: string
    category: string
    amount: number
    type: string
    payment_day: number | null
    is_staff: boolean
  }
) {
  const row = {
    name: payload.name,
    category: payload.category,
    amount: payload.amount,
    type: payload.type,
    payment_day: payload.payment_day,
    is_staff: payload.is_staff,
    is_active: true,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: null,
    notes: null,
    updated_at: nowIso(),
  }

  const result = await client.from("fixed_charges").insert(row)
  if (result.error) throw new Error(result.error.message)

  const { data, error } = await client
    .from("fixed_charges")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []).map(mapFixedCharge)
}
```

- [ ] **Step 3.4 : Ajouter handler POST dans app/api/charges/route.ts**

Ajouter l'import de `createFixedCharge` et `parseCreateChargeBody` en haut du fichier :

```ts
import { readSnapshot, updateFixedCharge, createFixedCharge } from "@/lib/server/supabase-store"
import { parseCreateChargeBody } from "@/lib/contracts"
```

Ajouter après le handler PUT :

```ts
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  try {
    const body = parseCreateChargeBody(await request.json())
    const charges = await createFixedCharge(supabase, body)
    return NextResponse.json({ charges })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json({ error: `Impossible de créer la charge. ${message}` }, { status: 500 })
  }
}
```

- [ ] **Step 3.5 : Lancer le build pour vérifier**

```bash
npm run build 2>&1 | tail -20
```

Expected : build OK, pas d'erreur TypeScript.

- [ ] **Step 3.6 : Commit**

```bash
git add lib/types.ts lib/contracts.ts lib/server/supabase-store.ts app/api/charges/route.ts
git commit -m "feat: add POST /api/charges and createFixedCharge()"
```

---

## Task 4 : UI ajout de charges dans /charges

**Files:**
- Modify: `lib/hooks/useCharges.ts`
- Modify: `app/(dashboard)/charges/page.tsx`

- [ ] **Step 4.1 : Ajouter createCharge() dans useCharges.ts**

Dans `lib/hooks/useCharges.ts`, ajouter après `deactivateCharge` :

```ts
const createCharge = async (payload: {
  name: string
  category: string
  amount: number
  type: "fixed" | "variable" | "semi-fixed"
  payment_day: number | null
  is_staff: boolean
}) => {
  const response = await fetch("/api/charges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) return
  const data = parseChargesPayload(await response.json())
  setCharges(data.charges)
}
```

L'ajouter dans le return de `useCharges` :

```ts
return {
  charges,
  byCategory,
  totalActive,
  breakeven,
  simExtra,
  setSimExtra,
  simulatedTotal,
  simulatedBreakeven,
  updateCharge,
  deactivateCharge,
  createCharge,  // ← nouveau
}
```

- [ ] **Step 4.2 : Ajouter le formulaire inline dans charges/page.tsx**

Remplacer le contenu complet de `app/(dashboard)/charges/page.tsx` par la version avec ajout de charges. Les changements clés :

1. Ajouter les imports `{ Plus, X }` de lucide-react et `{ Select, SelectContent, SelectItem, SelectTrigger, SelectValue }` de `@/components/ui/select`.

2. Ajouter l'état local pour le formulaire d'ajout :

```tsx
const [addingCat, setAddingCat] = useState<string | null>(null)
const [newName, setNewName] = useState("")
const [newAmount, setNewAmount] = useState("")
const [newType, setNewType] = useState<"fixed" | "variable" | "semi-fixed">("fixed")
const [newPayDay, setNewPayDay] = useState("")
const [addingNew, setAddingNew] = useState(false)
const [newCatName, setNewCatName] = useState("")

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
```

3. Dans chaque card de catégorie (dans `.map(([cat, label]) => ...)`), après la liste des items, ajouter le formulaire inline :

```tsx
{/* Bouton ajouter */}
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
```

4. Après les cards existantes, ajouter le bouton "Nouvelle catégorie" :

```tsx
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
          onClick={async () => { if (!newCatName || !newName || !newAmount) return; await handleCreate(newCatName); setAddingNew(false); setNewCatName("") }}>
          Créer
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAddingNew(false); resetAddForm() }}><X size={14}/></Button>
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
```

- [ ] **Step 4.3 : Lancer build et vérifier**

```bash
npm run build 2>&1 | tail -20
```

Expected : build OK.

- [ ] **Step 4.4 : Commit**

```bash
git add lib/hooks/useCharges.ts app/(dashboard)/charges/page.tsx
git commit -m "feat: add charge creation UI with per-category inline form"
```

---

## Task 5 : Route POST /api/objectives/alcool-validate + applyAlcoolLicenseUplift()

**Files:**
- Create: `app/api/objectives/alcool-validate/route.ts`
- Modify: `lib/server/supabase-store.ts`

- [ ] **Step 5.1 : Ajouter applyAlcoolLicenseUplift() dans supabase-store.ts**

Après `updateActionStatus`, ajouter :

```ts
export async function applyAlcoolLicenseUplift(
  client: SupabaseClientLike,
  payload: { actionId: string; effectMonth: string; upliftPct: number }
) {
  // 1. Fetch all monthly_objectives
  const { data: rows, error } = await client
    .from("monthly_objectives")
    .select("*")
    .order("year", { ascending: true })
    .order("month", { ascending: true })
  if (error) throw new Error(error.message)

  // 2. Apply uplift to months >= effectMonth
  const [effYear, effMonth] = payload.effectMonth.split("-").map(Number)
  const multiplier = 1 + payload.upliftPct / 100

  const toUpdate = (rows || []).filter((row: any) => {
    if (row.year > effYear) return true
    if (row.year === effYear && row.month >= effMonth) return true
    return false
  })

  for (const row of toUpdate) {
    const newTarget = Math.round(Number(row.target_ca) * multiplier)
    const { error: updateErr } = await client
      .from("monthly_objectives")
      .update({ target_ca: newTarget, notes: `${row.notes || ""} [+${payload.upliftPct}% alcool]`.trim() })
      .eq("year", row.year)
      .eq("month", row.month)
    if (updateErr) throw new Error(updateErr.message)
  }

  // 3. Recalculate realistic annual objective for current year
  const { data: updatedRows } = await client
    .from("monthly_objectives")
    .select("*")
    .eq("year", effYear)
  const annualSum = (updatedRows || []).reduce((s: number, r: any) => s + Number(r.target_ca), 0)
  await client
    .from("objectives")
    .update({ target_amount: annualSum, updated_at: nowIso() })
    .eq("year", effYear)
    .eq("scenario", "realistic")
    .eq("type", "ca_total")

  // 4. Mark action as done + store metadata
  const { error: actionErr } = await client
    .from("action_items")
    .update({
      status: "done",
      completed_at: nowIso(),
      updated_at: nowIso(),
      metadata: { alcool_uplift_pct: payload.upliftPct, alcool_effect_month: payload.effectMonth },
    })
    .eq("id", payload.actionId)
  if (actionErr) throw new Error(actionErr.message)

  // 5. Return updated monthly_objectives
  const { data: finalRows, error: finalErr } = await client
    .from("monthly_objectives")
    .select("*")
    .order("year", { ascending: true })
    .order("month", { ascending: true })
  if (finalErr) throw new Error(finalErr.message)
  return (finalRows || []).map(mapMonthlyObjective)
}
```

- [ ] **Step 5.2 : Créer app/api/objectives/alcool-validate/route.ts**

```ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { applyAlcoolLicenseUplift } from "@/lib/server/supabase-store"

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  try {
    const body = await request.json()
    const actionId = String(body?.actionId || "")
    const effectMonth = String(body?.effectMonth || "")
    const upliftPct = Number(body?.upliftPct ?? 47)

    if (!actionId || !effectMonth || !/^\d{4}-\d{2}$/.test(effectMonth)) {
      return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 })
    }
    if (upliftPct < 1 || upliftPct > 200) {
      return NextResponse.json({ error: "Uplift doit être entre 1 et 200%." }, { status: 400 })
    }

    const monthlyObjectives = await applyAlcoolLicenseUplift(supabase, {
      actionId,
      effectMonth,
      upliftPct,
    })
    return NextResponse.json({ monthlyObjectives, applied: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json({ error: `Impossible d'appliquer l'uplift. ${message}` }, { status: 500 })
  }
}
```

- [ ] **Step 5.3 : Lancer le build**

```bash
npm run build 2>&1 | tail -20
```

Expected : build OK.

- [ ] **Step 5.4 : Commit**

```bash
git add lib/server/supabase-store.ts app/api/objectives/alcool-validate/route.ts
git commit -m "feat: add applyAlcoolLicenseUplift and POST /api/objectives/alcool-validate"
```

---

## Task 6 : Dialogue de validation licence alcool dans /objectifs

**Files:**
- Modify: `app/(dashboard)/objectifs/page.tsx`

- [ ] **Step 6.1 : Ajouter état et logique de validation dans ObjectifsPage**

Dans `app/(dashboard)/objectifs/page.tsx`, ajouter dans le composant `ObjectifsPage` :

```tsx
const [alcoolDialogue, setAlcoolDialogue] = useState(false)
const [alcoolActionId, setAlcoolActionId] = useState("")
const [alcoolUplift, setAlcoolUplift] = useState(47)
const [alcoolMonth, setAlcoolMonth] = useState(() => {
  const next = new Date()
  next.setMonth(next.getMonth() + 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`
})
const [alcoolLoading, setAlcoolLoading] = useState(false)
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
  try {
    const res = await fetch("/api/objectives/alcool-validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId: alcoolActionId, effectMonth: alcoolMonth, upliftPct: alcoolUplift }),
    })
    if (res.ok) {
      setAlcoolDialogue(false)
      window.location.reload()
    }
  } finally {
    setAlcoolLoading(false)
  }
}
```

- [ ] **Step 6.2 : Modifier ActionCard pour détecter la licence alcool**

Modifier le composant `ActionCard` pour recevoir une prop `onAlcoolValidate` et l'afficher si l'action est la licence :

```tsx
function ActionCard({ action, onStatusChange, leverColors, onAlcoolValidate }: {
  action: ActionItem
  onStatusChange: (_id: string, _status: ActionItem["status"]) => void
  leverColors: Record<string, string>
  onAlcoolValidate?: (_id: string) => void
}) {
```

Dans le body de `ActionCard`, remplacer le bouton de status pour la licence alcool :

```tsx
const isAlcool = action.title.toLowerCase().includes("alcool")

{/* Bouton status */}
{isAlcool && action.status !== "done" && onAlcoolValidate ? (
  <button
    onClick={() => onAlcoolValidate(action.id)}
    className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
  >
    🍷 Valider licence
  </button>
) : (
  <button onClick={() => onStatusChange(action.id, next[action.status])}
    className={cn("flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition",
      action.status === "done" ? "bg-alaska-sage-lt text-alaska-sage border-alaska-sage"
      : action.status === "in_progress" ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-white text-alaska-muted border-alaska-sage-lt hover:bg-alaska-sage-lt")}>
    {action.status === "done" ? "✅ Fait" : action.status === "in_progress" ? "🔄 En cours" : "○ À faire"}
  </button>
)}
```

- [ ] **Step 6.3 : Passer onAlcoolValidate aux ActionCard dans le map**

Dans le `.map(action => <ActionCard .../>)` :

```tsx
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
  />
))}
```

- [ ] **Step 6.4 : Ajouter le dialogue de validation**

Avant le `</div>` final du composant, ajouter le dialogue modal inline :

```tsx
{alcoolDialogue && (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
      <div>
        <h2 className="font-playfair text-xl font-bold text-alaska-dark">🍷 Valider la licence alcool</h2>
        <p className="text-xs text-alaska-muted mt-1">Cela va mettre à jour tes objectifs futurs automatiquement</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-alaska-dark">Date d'effet (mois)</label>
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
```

- [ ] **Step 6.5 : Lancer le build**

```bash
npm run build 2>&1 | tail -20
```

Expected : build OK, pas d'erreur TypeScript.

- [ ] **Step 6.6 : Lancer tous les tests**

```bash
npm run test 2>&1 | tail -10
```

Expected : tous PASS.

- [ ] **Step 6.7 : Commit final**

```bash
git add app/(dashboard)/objectifs/page.tsx
git commit -m "feat: add alcohol license validation dialogue with monthly objectives uplift"
```

---

## Vérification finale

- [ ] Lancer `npm run dev` et vérifier :
  1. `/charges` — le seuil affiché correspond bien à la somme des vraies charges (pas 136 667)
  2. Dashboard → KPI "Seuil" — même valeur que dans `/charges`
  3. `/charges` — bouton "+ Ajouter un salarié" visible dans PERSONNEL, crée bien une ligne
  4. `/objectifs` → Plan d'action — "Obtenir la licence d'alcool" apparaît en tête
  5. Cliquer "Valider licence" → dialogue s'ouvre, preview correcte, confirmation met à jour les objectifs

---

## Self-Review

**Spec coverage :**
- ✅ Breakeven dynamique → Task 1
- ✅ Ajout charges UI → Tasks 3+4
- ✅ Licence alcool action item → Task 2
- ✅ Validation + uplift monthly_objectives → Tasks 5+6
- ✅ Persistance metadata → Task 5 (`metadata JSONB`)
- ✅ Annual objective realistic recalculé → `applyAlcoolLicenseUplift` step 3

**Placeholder scan :** Aucun TBD/TODO. Tout le code est complet.

**Type consistency :**
- `createFixedCharge` payload → `createCharge` payload dans useCharges → body du POST → identiques
- `applyAlcoolLicenseUplift` params → body du POST route → dialogue → identiques
- `mapMonthlyObjective` retourne `MonthlyObjective` → même type attendu par le client
