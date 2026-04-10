# Saisie — Modèles de dépenses configurables + fixes UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre les sections et items de dépenses journalières configurables (ajouter/supprimer catégories et items), charger le personnel depuis la DB, et corriger l'UI de saisie (solde caisse, labels).

**Architecture:** Deux nouvelles tables Supabase (`expense_sections`, `expense_item_templates`) stockent les sections (ex: "🥩 Matières Premières") et leurs items (ex: "Poissonnier"). Une API route et un hook client exposent ces données. La page saisie charge tout dynamiquement. L'UI de gestion est intégrée à la page `/charges` (admin only).

**Tech Stack:** Next.js App Router, Supabase/PostgreSQL, React hooks, Vitest, Tailwind CSS

---

## File Map

| Fichier | Action | Rôle |
|---------|--------|------|
| `supabase/migrations/20260410001000_expense_templates.sql` | Créer | Tables + seed + RLS |
| `lib/types.ts` | Modifier | Ajouter `ExpenseSection`, `ExpenseItemTemplate` |
| `lib/server/supabase-store.ts` | Modifier | CRUD `expense_sections` + `expense_item_templates` |
| `lib/contracts.ts` | Modifier | Parser `parseExpenseTemplatesPayload` |
| `app/api/expense-templates/route.ts` | Créer | GET (public auth), POST/DELETE (admin) |
| `lib/hooks/useExpenseTemplates.ts` | Créer | Hook client : charge + mutate sections/items |
| `app/(dashboard)/saisie/page.tsx` | Modifier | Staff depuis `useCharges`, sections dynamiques, fixes UI |
| `app/(dashboard)/charges/page.tsx` | Modifier | Section "Modèles de saisie" en bas de page |

---

## Task 1 : Migration DB — tables expense_sections et expense_item_templates

**Files:**
- Create: `supabase/migrations/20260410001000_expense_templates.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- expense_sections : sections affichées dans la page saisie (hors Personnel)
CREATE TABLE public.expense_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,                          -- "Matières Premières"
  emoji       text NOT NULL DEFAULT '📦',             -- "🥩"
  expense_category text NOT NULL DEFAULT 'AUTRE'
    CHECK (expense_category IN ('MP', 'CHARGES', 'AUTRE')),
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- expense_item_templates : items prédéfinis par section
CREATE TABLE public.expense_item_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  uuid NOT NULL REFERENCES public.expense_sections(id) ON DELETE CASCADE,
  label       text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0
);

-- RLS : lecture ouverte aux utilisateurs authentifiés, écriture admin uniquement
ALTER TABLE public.expense_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_item_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_sections_read" ON public.expense_sections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "expense_sections_write" ON public.expense_sections
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'admin')
  WITH CHECK (public.auth_user_role() = 'admin');

CREATE POLICY "expense_item_templates_read" ON public.expense_item_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "expense_item_templates_write" ON public.expense_item_templates
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'admin')
  WITH CHECK (public.auth_user_role() = 'admin');

-- Seed : sections et items initiaux
INSERT INTO public.expense_sections (name, emoji, expense_category, sort_order) VALUES
  ('Matières Premières', '🥩', 'MP',      1),
  ('Autres Charges',     '📦', 'CHARGES', 2);

-- Items MP
WITH sec AS (SELECT id FROM public.expense_sections WHERE expense_category = 'MP' LIMIT 1)
INSERT INTO public.expense_item_templates (section_id, label, sort_order)
SELECT sec.id, label, sort_order FROM sec, (VALUES
  ('Poissonnier',          1),
  ('Boucher',              2),
  ('Poulet',               3),
  ('Eau',                  4),
  ('Technicien & courses', 5)
) AS t(label, sort_order);

-- Items Autres Charges
WITH sec AS (SELECT id FROM public.expense_sections WHERE expense_category = 'CHARGES' LIMIT 1)
INSERT INTO public.expense_item_templates (section_id, label, sort_order)
SELECT sec.id, label, sort_order FROM sec, (VALUES
  ('Loyer',        1),
  ('Électricité',  2),
  ('Gaz',          3),
  ('Internet',     4),
  ('Autre',        5)
) AS t(label, sort_order);
```

- [ ] **Step 2 : Appliquer la migration via MCP Supabase**

```bash
# Via mcp__supabase__apply_migration ou directement via execute_sql
```

- [ ] **Step 3 : Vérifier les données en base**

```sql
SELECT s.name, s.emoji, s.expense_category, t.label
FROM expense_sections s
JOIN expense_item_templates t ON t.section_id = s.id
ORDER BY s.sort_order, t.sort_order;
```

Résultat attendu : 5 items MP + 5 items CHARGES.

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/20260410001000_expense_templates.sql
git commit -m "feat: add expense_sections and expense_item_templates tables with seed"
```

---

## Task 2 : Types + contracts

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/contracts.ts`

- [ ] **Step 1 : Ajouter les types dans `lib/types.ts`**

Ajouter après `FixedCharge` :

```typescript
export interface ExpenseItemTemplate {
  id: string
  section_id: string
  label: string
  is_active: boolean
  sort_order: number
}

export interface ExpenseSection {
  id: string
  name: string
  emoji: string
  expense_category: "MP" | "CHARGES" | "AUTRE"
  sort_order: number
  is_active: boolean
  items: ExpenseItemTemplate[]
}
```

- [ ] **Step 2 : Ajouter le parser dans `lib/contracts.ts`**

Lire le fichier `lib/contracts.ts` d'abord, puis ajouter :

```typescript
export function parseExpenseTemplatesPayload(raw: unknown): { sections: ExpenseSection[] } {
  if (!raw || typeof raw !== "object") return { sections: [] }
  const obj = raw as Record<string, unknown>
  const sections = Array.isArray(obj.sections) ? obj.sections : []
  return {
    sections: sections.map((s: any) => ({
      id: String(s.id ?? ""),
      name: String(s.name ?? ""),
      emoji: String(s.emoji ?? "📦"),
      expense_category: (["MP", "CHARGES", "AUTRE"].includes(s.expense_category) ? s.expense_category : "AUTRE") as "MP" | "CHARGES" | "AUTRE",
      sort_order: Number(s.sort_order ?? 0),
      is_active: Boolean(s.is_active ?? true),
      items: Array.isArray(s.items) ? s.items.map((t: any) => ({
        id: String(t.id ?? ""),
        section_id: String(t.section_id ?? ""),
        label: String(t.label ?? ""),
        is_active: Boolean(t.is_active ?? true),
        sort_order: Number(t.sort_order ?? 0),
      })) : [],
    })),
  }
}
```

- [ ] **Step 3 : Commit**

```bash
git add lib/types.ts lib/contracts.ts
git commit -m "feat: add ExpenseSection and ExpenseItemTemplate types and parser"
```

---

## Task 3 : Fonctions serveur dans supabase-store.ts

**Files:**
- Modify: `lib/server/supabase-store.ts`

- [ ] **Step 1 : Ajouter les fonctions CRUD à la fin de `lib/server/supabase-store.ts`**

```typescript
export async function getExpenseSections(supabase: SupabaseClientLike): Promise<ExpenseSection[]> {
  const { data: sections, error: secErr } = await supabase
    .from("expense_sections")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")

  if (secErr) return []

  const { data: items, error: itemErr } = await supabase
    .from("expense_item_templates")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")

  if (itemErr) return []

  return (sections || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    emoji: s.emoji,
    expense_category: s.expense_category,
    sort_order: s.sort_order,
    is_active: s.is_active,
    items: (items || []).filter((t: any) => t.section_id === s.id),
  }))
}

export async function createExpenseSection(
  supabase: SupabaseClientLike,
  payload: { name: string; emoji: string; expense_category: "MP" | "CHARGES" | "AUTRE" }
): Promise<ExpenseSection[]> {
  const maxOrder = await supabase
    .from("expense_sections")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
  const nextOrder = ((maxOrder.data?.[0]?.sort_order) ?? 0) + 1
  await supabase.from("expense_sections").insert({ ...payload, sort_order: nextOrder })
  return getExpenseSections(supabase)
}

export async function deleteExpenseSection(
  supabase: SupabaseClientLike,
  id: string
): Promise<ExpenseSection[]> {
  await supabase.from("expense_sections").delete().eq("id", id)
  return getExpenseSections(supabase)
}

export async function createExpenseItem(
  supabase: SupabaseClientLike,
  payload: { section_id: string; label: string }
): Promise<ExpenseSection[]> {
  const maxOrder = await supabase
    .from("expense_item_templates")
    .select("sort_order")
    .eq("section_id", payload.section_id)
    .order("sort_order", { ascending: false })
    .limit(1)
  const nextOrder = ((maxOrder.data?.[0]?.sort_order) ?? 0) + 1
  await supabase.from("expense_item_templates").insert({ ...payload, sort_order: nextOrder })
  return getExpenseSections(supabase)
}

export async function deleteExpenseItem(
  supabase: SupabaseClientLike,
  id: string
): Promise<ExpenseSection[]> {
  await supabase.from("expense_item_templates").delete().eq("id", id)
  return getExpenseSections(supabase)
}
```

Aussi ajouter l'import du type `ExpenseSection` en haut du fichier :

```typescript
import type { ..., ExpenseSection } from "@/lib/types"
```

- [ ] **Step 2 : Lancer les tests existants pour vérifier qu'on n'a rien cassé**

```bash
npm run test
```

Attendu : tous les tests passent.

- [ ] **Step 3 : Commit**

```bash
git add lib/server/supabase-store.ts
git commit -m "feat: add CRUD functions for expense sections and items in supabase-store"
```

---

## Task 4 : API route /api/expense-templates

**Files:**
- Create: `app/api/expense-templates/route.ts`

- [ ] **Step 1 : Créer la route**

```typescript
import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"
import {
  getExpenseSections,
  createExpenseSection,
  deleteExpenseSection,
  createExpenseItem,
  deleteExpenseItem,
} from "@/lib/server/supabase-store"

export async function GET() {
  const supabase = createClient()
  try {
    await supabase.auth.getUser()
    const sections = await getExpenseSections(supabase)
    return NextResponse.json({ sections })
  } catch {
    return NextResponse.json({ error: "Impossible de charger les modèles." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const body = await request.json()

  try {
    if (body.type === "section") {
      const { name, emoji, expense_category } = body
      if (!name || !expense_category) return NextResponse.json({ error: "Données manquantes." }, { status: 400 })
      const sections = await createExpenseSection(supabase, { name, emoji: emoji || "📦", expense_category })
      return NextResponse.json({ sections })
    }

    if (body.type === "item") {
      const { section_id, label } = body
      if (!section_id || !label) return NextResponse.json({ error: "Données manquantes." }, { status: 400 })
      const sections = await createExpenseItem(supabase, { section_id, label })
      return NextResponse.json({ sections })
    }

    return NextResponse.json({ error: "Type invalide." }, { status: 400 })
  } catch {
    return NextResponse.json({ error: "Impossible de créer l'élément." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const type = searchParams.get("type")
  if (!id || !type) return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 })

  try {
    const sections = type === "section"
      ? await deleteExpenseSection(supabase, id)
      : await deleteExpenseItem(supabase, id)
    return NextResponse.json({ sections })
  } catch {
    return NextResponse.json({ error: "Impossible de supprimer." }, { status: 500 })
  }
}
```

- [ ] **Step 2 : Commit**

```bash
git add app/api/expense-templates/route.ts
git commit -m "feat: add /api/expense-templates route (GET/POST/DELETE)"
```

---

## Task 5 : Hook client useExpenseTemplates

**Files:**
- Create: `lib/hooks/useExpenseTemplates.ts`

- [ ] **Step 1 : Créer le hook**

```typescript
"use client"

import { useCallback, useEffect, useState } from "react"
import { parseExpenseTemplatesPayload } from "@/lib/contracts"
import type { ExpenseSection } from "@/lib/types"

export function useExpenseTemplates() {
  const [sections, setSections] = useState<ExpenseSection[]>([])

  const load = useCallback(() => {
    fetch("/api/expense-templates")
      .then(async (r) => parseExpenseTemplatesPayload(await r.json()))
      .then((data) => setSections(data.sections))
      .catch(() => setSections([]))
  }, [])

  useEffect(() => { load() }, [load])

  const createSection = useCallback(async (payload: { name: string; emoji: string; expense_category: "MP" | "CHARGES" | "AUTRE" }) => {
    const r = await fetch("/api/expense-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "section", ...payload }),
    })
    if (!r.ok) return
    const data = parseExpenseTemplatesPayload(await r.json())
    setSections(data.sections)
  }, [])

  const createItem = useCallback(async (section_id: string, label: string) => {
    const r = await fetch("/api/expense-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "item", section_id, label }),
    })
    if (!r.ok) return
    const data = parseExpenseTemplatesPayload(await r.json())
    setSections(data.sections)
  }, [])

  const deleteSection = useCallback(async (id: string) => {
    const r = await fetch(`/api/expense-templates?id=${id}&type=section`, { method: "DELETE" })
    if (!r.ok) return
    const data = parseExpenseTemplatesPayload(await r.json())
    setSections(data.sections)
  }, [])

  const deleteItem = useCallback(async (id: string) => {
    const r = await fetch(`/api/expense-templates?id=${id}&type=item`, { method: "DELETE" })
    if (!r.ok) return
    const data = parseExpenseTemplatesPayload(await r.json())
    setSections(data.sections)
  }, [])

  return { sections, createSection, createItem, deleteSection, deleteItem }
}
```

- [ ] **Step 2 : Commit**

```bash
git add lib/hooks/useExpenseTemplates.ts
git commit -m "feat: add useExpenseTemplates client hook"
```

---

## Task 6 : Fixes page saisie — staff réel + sections dynamiques + UI solde

**Files:**
- Modify: `app/(dashboard)/saisie/page.tsx`

### 6a — Remplacer staff mocké par useCharges

- [ ] **Step 1 : Supprimer l'import mock et ajouter useCharges + useExpenseTemplates**

Remplacer :
```typescript
import { FIXED_CHARGES } from "@/lib/mock-data"
```
Par :
```typescript
// (rien — FIXED_CHARGES n'est plus utilisé)
```

Ajouter les imports de hooks (déjà `useCharges` n'est pas là — l'ajouter) :
```typescript
import { useCharges } from "@/lib/hooks/useCharges"
import { useExpenseTemplates } from "@/lib/hooks/useExpenseTemplates"
```

Supprimer les constantes hardcodées en haut du fichier :
```typescript
// SUPPRIMER ces deux lignes :
const MP_POSTES = ["Poissonnier","Boucher","Poulet","Eau","Technicien & courses"]
const AUTRES_POSTES = ["Loyer","Électricité","Gaz","Internet","Autre"]
```

- [ ] **Step 2 : Remplacer l'usage du mock staff dans le composant**

Dans `SaisiePage`, remplacer :
```typescript
// AVANT
const staff = FIXED_CHARGES.filter(c => c.is_staff && c.is_active)
```
Par :
```typescript
const { charges } = useCharges()
const { sections } = useExpenseTemplates()
const staff = charges.filter(c => c.is_staff && c.is_active)
```

### 6b — Sections dynamiques

- [ ] **Step 3 : Remplacer les blocs MP et Autres hardcodés**

Remplacer les deux blocs `<ExpenseGroup>` MP et Autres (lignes `<ExpenseGroup title="🥩 Matières Premières"...>` et `<ExpenseGroup title="📦 Autres Charges"...>`) par un rendu dynamique :

```typescript
{sections.map(section => (
  <ExpenseGroup key={section.id} title={`${section.emoji} ${section.name}`} defaultOpen={section.expense_category === "MP"}>
    {section.items.map(item => {
      const exp = getOrCreateExpense(item.label, section.expense_category)
      return (
        <ExpenseRow
          key={item.id}
          label={item.label}
          value={exp.amount}
          onChange={v => handleExpenseChange(item.label, section.expense_category, v)}
        />
      )
    })}
  </ExpenseGroup>
))}
```

### 6c — Fix UI récap bas de page

- [ ] **Step 4 : Renommer "CA Caisse du jour" → "CA Cash"**

Dans `saisie/page.tsx`, remplacer :
```typescript
💰 CA Caisse du jour
```
Par :
```typescript
💵 CA Cash
```

- [ ] **Step 5 : Mettre à jour la variable soldeCaisse et la carte récap**

Remplacer :
```typescript
const soldeCaisse = entry.ca_caisse - totalExpenses
```
Par :
```typescript
const soldeCaisse = entry.ca_caisse - entry.mouvement_caisse - totalExpenses
```

Dans la carte récap (bg-alaska-dark), ajouter la ligne "Sortie caisse" entre "CA Caisse" et "Total sorties" :

```typescript
<div className="flex justify-between text-sm">
  <span className="text-alaska-muted">CA Cash</span>
  <span className="font-semibold">{formatMAD(entry.ca_caisse)}</span>
</div>
{entry.mouvement_caisse > 0 && (
  <div className="flex justify-between text-sm">
    <span className="text-alaska-muted">Sortie caisse</span>
    <span className="font-semibold text-orange-300">-{formatMAD(entry.mouvement_caisse)}</span>
  </div>
)}
<div className="flex justify-between text-sm">
  <span className="text-alaska-muted">Total dépenses</span>
  <span className="font-semibold text-orange-300">-{formatMAD(totalExpenses)}</span>
</div>
```

Mettre à jour le libellé "Total sorties" → "Total dépenses" partout dans la carte.

- [ ] **Step 6 : Lancer les tests + lint**

```bash
npm run test && npm run lint
```

Attendu : tous les tests passent, 0 erreur lint.

- [ ] **Step 7 : Commit**

```bash
git add app/(dashboard)/saisie/page.tsx
git commit -m "feat: load staff from DB, dynamic expense sections, fix solde caisse formula"
```

---

## Task 7 : UI de gestion des modèles dans la page /charges

**Files:**
- Modify: `app/(dashboard)/charges/page.tsx`

- [ ] **Step 1 : Ajouter l'import du hook dans charges/page.tsx**

```typescript
import { useExpenseTemplates } from "@/lib/hooks/useExpenseTemplates"
```

- [ ] **Step 2 : Ajouter les états locaux pour le formulaire d'ajout**

Dans `ChargesPage`, ajouter :
```typescript
const { sections, createSection, createItem, deleteSection, deleteItem } = useExpenseTemplates()
const [addingItemSectionId, setAddingItemSectionId] = useState<string | null>(null)
const [newItemLabel, setNewItemLabel] = useState("")
const [addingNewSection, setAddingNewSection] = useState(false)
const [newSectionName, setNewSectionName] = useState("")
const [newSectionEmoji, setNewSectionEmoji] = useState("📦")
const [newSectionCategory, setNewSectionCategory] = useState<"MP" | "CHARGES" | "AUTRE">("AUTRE")
```

- [ ] **Step 3 : Ajouter la section "Modèles de saisie" en bas de la page, avant le bouton "Nouvelle catégorie"**

```typescript
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
```

- [ ] **Step 4 : Lint + build**

```bash
npm run lint && npm run build
```

Attendu : 0 erreur.

- [ ] **Step 5 : Commit final**

```bash
git add app/(dashboard)/charges/page.tsx
git commit -m "feat: add expense template management UI in charges page"
```

---

## Self-Review

### Couverture spec
- [x] Staff chargé depuis DB (via `useCharges`) — Task 6a
- [x] Items MP et Autres configurables — Tasks 1, 5, 6b
- [x] Créer nouvelle catégorie — Task 7
- [x] Ajouter/supprimer items dans catégorie — Tasks 4, 5, 7
- [x] Renommer "CA Caisse" → "CA Cash" — Task 6c
- [x] Afficher "Sortie caisse" séparément — Task 6c
- [x] Formule solde corrigée (- mouvement_caisse) — Task 6c
- [x] "Légumes" test data supprimé — Fait directement en DB avant le plan

### Cohérence des types
- `ExpenseSection.expense_category` : `"MP" | "CHARGES" | "AUTRE"` — utilisé identiquement dans types.ts, contracts.ts, API, hook
- `handleExpenseChange(label, section.expense_category, v)` compatible avec `"MP" | "RH" | "CHARGES" | "AUTRE"` ✓
