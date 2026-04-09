# Suivi du Solde Caisse Cumulé — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher en permanence dans /saisie le solde cumulé de la caisse et le montant à déposer, avec une ligne "Virement banque" dédiée qui remplace l'ancienne entrée "Othman".

**Architecture:** `buildCaisseBalance(db)` dans `analytics.ts` agrège toutes les ventes et dépenses historiques. Un endpoint GET `/api/caisse/balance` expose ce calcul. Le hook `useCaisseBalance` le consomme côté client. La page `/saisie` affiche une carte de solde en haut du formulaire et une section "Virement banque" avec bordure dorée avant le récapitulatif.

**Tech Stack:** Next.js 14 App Router, Supabase SSR, React hooks, Vitest, Tailwind CSS

---

## File Structure

- **Create:** `tests/analytics.test.ts` — tests unitaires de `buildCaisseBalance`
- **Modify:** `lib/server/analytics.ts` — ajouter `buildCaisseBalance(db: PilotDb)`
- **Create:** `app/api/caisse/balance/route.ts` — GET endpoint lecture seule
- **Create:** `lib/hooks/useCaisseBalance.ts` — hook client avec `refetch`
- **Modify:** `app/(dashboard)/saisie/page.tsx` — carte solde + section virement

---

## Task 1: `buildCaisseBalance` dans analytics.ts

**Files:**
- Create: `tests/analytics.test.ts`
- Modify: `lib/server/analytics.ts` (après la fonction `buildLastSixMonths`, ligne ~228)

**Contexte codebase:**
- `lib/server/analytics.ts` commence par `import "server-only"` — les tests doivent mocker ce module
- `PilotDb` est défini dans `lib/server/pilot-store.ts` et contient `daily_sales: DailySaleRecord[]` et `expenses: ExpenseRecord[]`
- Pattern test existant dans `tests/pilot-store.test.ts` : `vi.mock("server-only", () => ({}))` avant les imports

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/analytics.test.ts` :

```ts
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { buildCaisseBalance } from "../lib/server/analytics"
import type { PilotDb } from "../lib/server/pilot-store"

function makeDb(overrides: Partial<PilotDb> = {}): PilotDb {
  return {
    users: [],
    daily_sales: [],
    expenses: [],
    fixed_charges: [],
    objectives: [],
    monthly_objectives: [],
    action_items: [],
    import_history: [],
    ...overrides,
  } as PilotDb
}

describe("buildCaisseBalance", () => {
  it("computes balance and toDeposit from all sales and expenses", () => {
    const db = makeDb({
      daily_sales: [
        { id: "s1", date: "2026-01-01", ca_caisse: 5000, ca_b2b: 0, ca_soir: 0, pct_soir: 0, tickets_count: 30, notes: "", source: "manual", import_id: null, created_by: null, updated_at: "" },
        { id: "s2", date: "2026-01-02", ca_caisse: 3000, ca_b2b: 0, ca_soir: 0, pct_soir: 0, tickets_count: 20, notes: "", source: "manual", import_id: null, created_by: null, updated_at: "" },
      ],
      expenses: [
        { id: "e1", date: "2026-01-01", category: "MP", label: "Poissonnier", amount: 2000, notes: "", created_by: null, updated_at: "" },
        { id: "e2", date: "2026-01-02", category: "CHARGES", label: "Virement banque", amount: 1500, notes: "", created_by: null, updated_at: "" },
      ],
    })
    // balance = (5000 + 3000) - (2000 + 1500) = 4500
    // toDeposit = max(0, 4500 - 1000) = 3500
    const result = buildCaisseBalance(db)
    expect(result.balance).toBe(4500)
    expect(result.toDeposit).toBe(3500)
  })

  it("returns toDeposit 0 when balance is below 1000 MAD reserve", () => {
    const db = makeDb({
      daily_sales: [
        { id: "s1", date: "2026-01-01", ca_caisse: 800, ca_b2b: 0, ca_soir: 0, pct_soir: 0, tickets_count: 5, notes: "", source: "manual", import_id: null, created_by: null, updated_at: "" },
      ],
    })
    // balance = 800, toDeposit = max(0, 800 - 1000) = 0
    const result = buildCaisseBalance(db)
    expect(result.balance).toBe(800)
    expect(result.toDeposit).toBe(0)
  })

  it("returns zero balance and toDeposit when no data", () => {
    const result = buildCaisseBalance(makeDb())
    expect(result.balance).toBe(0)
    expect(result.toDeposit).toBe(0)
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

```bash
cd "C:\Users\OthmanBEKRI\OneDrive - UTM\09 - KAYZARAN\10.ALASKA-PILOT\claude"
npm run test -- tests/analytics.test.ts
```

Expected: FAIL — `buildCaisseBalance is not a function`

- [ ] **Step 3: Implémenter `buildCaisseBalance` dans analytics.ts**

Ajouter à la fin de `lib/server/analytics.ts` (après la dernière fonction exportée) :

```ts
export function buildCaisseBalance(db: PilotDb): { balance: number; toDeposit: number } {
  const totalCA = db.daily_sales.reduce((sum, r) => sum + r.ca_caisse, 0)
  const totalExp = db.expenses.reduce((sum, e) => sum + e.amount, 0)
  const balance = totalCA - totalExp
  return { balance, toDeposit: Math.max(0, balance - 1000) }
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npm run test -- tests/analytics.test.ts
```

Expected: 3 tests PASS

- [ ] **Step 5: Lancer tous les tests**

```bash
npm run test
```

Expected: tous les tests passent (14 tests au total)

- [ ] **Step 6: Commit**

```bash
git add tests/analytics.test.ts lib/server/analytics.ts
git commit -m "feat: add buildCaisseBalance to analytics"
```

---

## Task 2: API route GET /api/caisse/balance + hook useCaisseBalance

**Files:**
- Create: `app/api/caisse/balance/route.ts`
- Create: `lib/hooks/useCaisseBalance.ts`

**Contexte codebase:**
- Pattern API route existant dans `app/api/charges/route.ts` : `createClient()`, `readSnapshot()`, `NextResponse.json()`
- `readSnapshot` est importé depuis `@/lib/server/supabase-store`
- `buildCaisseBalance` vient d'être ajouté dans `@/lib/server/analytics`
- Pattern hook existant dans `lib/hooks/useCharges.ts` : `useEffect` + `fetch` + `useState`
- Cet endpoint est accessible par admin et manager (pas de garde 403)

- [ ] **Step 1: Créer l'API route**

Créer `app/api/caisse/balance/route.ts` :

```ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { readSnapshot } from "@/lib/server/supabase-store"
import { buildCaisseBalance } from "@/lib/server/analytics"

export async function GET() {
  const supabase = createClient()
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const db = await readSnapshot(supabase, { seedIfEmpty: Boolean(user), userId: user?.id || null })
    const result = buildCaisseBalance(db)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Impossible de calculer le solde caisse." }, { status: 500 })
  }
}
```

- [ ] **Step 2: Créer le hook client**

Créer `lib/hooks/useCaisseBalance.ts` :

```ts
"use client"

import { useCallback, useEffect, useState } from "react"

export function useCaisseBalance() {
  const [balance, setBalance] = useState(0)
  const [toDeposit, setToDeposit] = useState(0)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    setLoading(true)
    fetch("/api/caisse/balance")
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        setBalance(data.balance ?? 0)
        setToDeposit(data.toDeposit ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { balance, toDeposit, loading, refetch }
}
```

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -20
```

Expected: build réussi, route `/api/caisse/balance` apparaît dans la liste

- [ ] **Step 4: Lancer tous les tests**

```bash
npm run test
```

Expected: tous les tests passent

- [ ] **Step 5: Commit**

```bash
git add app/api/caisse/balance/route.ts lib/hooks/useCaisseBalance.ts
git commit -m "feat: add GET /api/caisse/balance and useCaisseBalance hook"
```

---

## Task 3: UI — Carte solde + Virement banque dans /saisie

**Files:**
- Modify: `app/(dashboard)/saisie/page.tsx`

**Contexte codebase:**

La page Saisie est dans `app/(dashboard)/saisie/page.tsx`. L'onglet "Saisie" est au début du return JSX (ligne ~87) et contient dans l'ordre :
1. Card date picker (ligne ~89)
2. Card CA Caisse (ligne ~110)
3. `<ExpenseGroup title="🥩 Matières Premières">` (ligne ~141)
4. `<ExpenseGroup title="👥 Personnel">` (ligne ~148)
5. `<ExpenseGroup title="📦 Autres Charges">` (ligne ~164)
6. Card récapitulatif / solde caisse journalier (ligne ~171, fond `alaska-dark`)

À faire :
- Ajouter `useCaisseBalance` au début du composant
- Ajouter `const [virementOpen, setVirementOpen] = useState(false)` dans les états
- Ajouter la carte "Solde caisse cumulé" **avant** la Card date picker (ligne ~89)
- Ajouter la section "Virement banque" **entre** `ExpenseGroup Autres Charges` et la Card récapitulatif
- Remplacer `onClick={save}` par `onClick={async () => { await save(); refetchBalance() }}` sur le bouton Enregistrer

- [ ] **Step 1: Ajouter l'import et les hooks dans le composant**

Trouver la ligne d'imports (ligne 1-17) et ajouter :
```ts
import { useCaisseBalance } from "@/lib/hooks/useCaisseBalance"
```

Trouver dans le corps du composant les lignes de hooks existants (après ligne 43 environ) et ajouter :
```ts
const { balance, toDeposit, refetch: refetchBalance } = useCaisseBalance()
```

Trouver le bloc de `useState` existants (lignes 28-33 environ) et ajouter :
```ts
const [virementOpen, setVirementOpen] = useState(false)
```

- [ ] **Step 2: Ajouter la carte "Solde caisse cumulé"**

Dans le JSX de l'onglet `{tab === "Saisie" && (`, **avant** la Card du date picker (celle qui contient `ChevronLeft/ChevronRight` et le format de date), insérer :

```tsx
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
    <p className="text-[10px] text-alaska-muted text-right">Réserve 1 000 MAD · Fonds permanent 1 500 MAD hors app</p>
  </CardContent>
</Card>
```

- [ ] **Step 3: Ajouter la section "Virement banque"**

**Après** le `<ExpenseGroup title="📦 Autres Charges">` et **avant** la Card récapitulatif (celle avec `className="bg-alaska-dark text-white rounded-xl"`), insérer :

```tsx
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
```

- [ ] **Step 4: Mettre à jour le bouton Enregistrer**

Trouver la ligne (dans la Card récapitulatif) :
```tsx
<Button onClick={save} className="w-full mt-3 bg-white text-alaska-dark hover:bg-alaska-sage-lt font-semibold">
```

Remplacer par :
```tsx
<Button onClick={async () => { await save(); refetchBalance() }} className="w-full mt-3 bg-white text-alaska-dark hover:bg-alaska-sage-lt font-semibold">
```

- [ ] **Step 5: Build**

```bash
npm run build 2>&1 | tail -25
```

Expected: build réussi, aucune erreur TypeScript

- [ ] **Step 6: Lancer tous les tests**

```bash
npm run test
```

Expected: 14 tests PASS

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/saisie/page.tsx"
git commit -m "feat: add cumulative cash balance card and Virement banque section in saisie"
```
