# Pilotage Fournisseurs & Métriques Restaurant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter la saisie mensuelle des fournisseurs virement (Poulet, Nor Saga, Solidernet), les métriques prime cost + résultat net, et un graphique 4 semaines vs N-1 dans le reporting, en supprimant les blocs PDF/bancaires.

**Architecture:** Les fournisseurs mensuels sont stockés comme des dépenses ordinaires sur le 1er du mois via l'API daily-entry existante. Les métriques sont calculées côté serveur dans `buildCashMonthSummary`. Le graphique hebdomadaire vient d'une nouvelle fonction `buildLast4WeeksComparison` exportée depuis analytics.ts.

**Tech Stack:** Next.js 14, TypeScript, Supabase, Recharts (déjà installé), date-fns (déjà installé), Vitest

---

## File Map

| Fichier | Action |
|---------|--------|
| `supabase/migrations/20260511000000_monthly_supplier_templates.sql` | Créer |
| `lib/server/analytics.ts` | Modifier — `buildCashMonthSummary` + `buildLast4WeeksComparison` |
| `lib/contracts.ts` | Modifier — `cashMonthSchema` + `weekComparisonSchema` + `reportingPayloadSchema` |
| `lib/hooks/useDashboard.ts` | Modifier — type + defaults |
| `lib/hooks/useMonthlySuppliers.ts` | Créer |
| `app/api/reporting/route.ts` | Modifier — ajouter `weekComparison` |
| `app/(dashboard)/saisie/page.tsx` | Modifier — cartes Fournisseurs + Pilotage dans onglet Mois |
| `app/(dashboard)/reporting/page.tsx` | Modifier — supprimer blocs banque, ajouter chart + métriques |
| `tests/analytics.test.ts` | Modifier — nouveaux tests |

---

## Task 1: Migration SQL — désactiver Poulet des templates journaliers

**Files:**
- Create: `supabase/migrations/20260511000000_monthly_supplier_templates.sql`

- [ ] **Step 1: Créer le fichier de migration**

```sql
-- supabase/migrations/20260511000000_monthly_supplier_templates.sql

-- Poulet est désormais saisi mensuellement (virement fournisseur).
-- On le désactive dans la section MP journalière pour éviter le double comptage.
UPDATE expense_item_templates
SET is_active = false
WHERE label = 'Poulet'
  AND section_id = (
    SELECT id FROM expense_sections
    WHERE name = 'Matières Premières'
    LIMIT 1
  );
```

- [ ] **Step 2: Appliquer la migration en production**

```bash
npx supabase db push
```

Si le CLI n'est pas connecté au projet distant, appliquer directement via le dashboard Supabase SQL Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260511000000_monthly_supplier_templates.sql
git commit -m "feat: désactiver Poulet des templates journaliers (saisie mensuelle)"
```

---

## Task 2: Analytics — prime_cost_pct + resultat_net dans buildCashMonthSummary

**Files:**
- Modify: `lib/server/analytics.ts`
- Modify: `tests/analytics.test.ts`

- [ ] **Step 1: Ajouter les helpers de test dans analytics.test.ts**

Ajouter après la fonction `makeSale` existante (ligne ~46) :

```typescript
function makeExpense(overrides: Partial<PilotDb["expenses"][number]> = {}): PilotDb["expenses"][number] {
  return {
    id: "exp1",
    date: "2026-05-10",
    category: "MP",
    label: "Boucher",
    amount: 0,
    notes: "",
    created_by: null,
    updated_at: "",
    ...overrides,
  }
}

function makeFixedCharge(overrides: Partial<PilotDb["fixed_charges"][number]> = {}): PilotDb["fixed_charges"][number] {
  return {
    id: "fc1",
    name: "Loyer",
    category: "LOYER",
    amount: 0,
    type: "fixed",
    payment_day: null,
    is_staff: false,
    is_active: true,
    start_date: "2026-01-01",
    end_date: null,
    ...overrides,
  }
}
```

- [ ] **Step 2: Écrire les tests qui échouent**

Ajouter à la fin de `tests/analytics.test.ts` :

```typescript
describe("buildCashMonthSummary — prime_cost_pct et resultat_net", () => {
  it("calcule prime_cost_pct = (MP + RH) / CA global * 100", () => {
    const db = makeDb({
      daily_sales: [
        makeSale({ id: "s1", date: "2026-05-10", ca_caisse: 5000, ca_b2b: 2000 }),
      ],
      expenses: [
        makeExpense({ id: "e1", date: "2026-05-01", category: "MP", label: "Poulet", amount: 3000 }),
        makeExpense({ id: "e2", date: "2026-05-10", category: "RH", label: "Ahmed", amount: 2000 }),
      ],
      fixed_charges: [],
    })
    // ca_global = 7000, mp = 3000, rh = 2000 → 5000/7000 * 100 ≈ 71.43
    const { cashMonth } = buildDashboardData(db, "2026-05")
    expect(cashMonth.prime_cost_pct).toBeCloseTo(71.43, 1)
  })

  it("prime_cost_pct vaut 0 quand CA global est 0", () => {
    const db = makeDb({ daily_sales: [], expenses: [], fixed_charges: [] })
    const { cashMonth } = buildDashboardData(db, "2026-05")
    expect(cashMonth.prime_cost_pct).toBe(0)
  })

  it("calcule resultat_net = CA - MP - RH - charges fixes actives du mois", () => {
    const db = makeDb({
      daily_sales: [
        makeSale({ id: "s1", date: "2026-05-10", ca_caisse: 10000, ca_b2b: 0 }),
      ],
      expenses: [
        makeExpense({ id: "e1", date: "2026-05-01", category: "MP", label: "Poulet", amount: 3000 }),
        makeExpense({ id: "e2", date: "2026-05-10", category: "RH", label: "Ahmed", amount: 2000 }),
      ],
      fixed_charges: [
        makeFixedCharge({ id: "fc1", name: "Loyer", amount: 8000, is_active: true, start_date: "2026-01-01" }),
      ],
    })
    // resultat = 10000 - 3000 - 2000 - 8000 = -3000
    const { cashMonth } = buildDashboardData(db, "2026-05")
    expect(cashMonth.resultat_net).toBe(-3000)
  })
})
```

- [ ] **Step 3: Vérifier que les tests échouent**

```bash
npm run test -- --reporter=verbose 2>&1 | grep -A 3 "prime_cost"
```

Résultat attendu : `TypeError: cashMonth.prime_cost_pct is not a number` ou `undefined`.

- [ ] **Step 4: Implémenter dans analytics.ts**

Dans `lib/server/analytics.ts`, modifier la fonction `buildCashMonthSummary` (actuellement autour de la ligne 250).

Remplacer :

```typescript
function buildCashMonthSummary(db: PilotDb, month: string) {
  const sales = monthEntries(db, month)
  const expenses = monthExpenses(db, month)
  const cash_sales = sales.reduce((sum, item) => sum + getCashSalesReference(item), 0)
  const cash_movements = sales.reduce((sum, item) => sum + getCashMovementsReference(item), 0)
  const mpDiversExpenses = expenses.filter((e) => e.category === "MP" || e.category === "AUTRE")
  const cash_mp_divers = mpDiversExpenses.reduce((sum, e) => sum + e.amount, 0)
  const mp_divers_items = Object.entries(
    mpDiversExpenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.label] = (acc[e.label] || 0) + e.amount
      return acc
    }, {})
  )
    .map(([label, amount]) => ({ label, amount }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  const cash_charges = expenses
    .filter((e) => e.category === "CHARGES" && e.label !== VIREMENT_BANQUE_LABEL)
    .reduce((sum, e) => sum + e.amount, 0)
  const cash_rh = expenses
    .filter((e) => e.category === "RH")
    .reduce((sum, e) => sum + e.amount, 0)
  const cash_depot = expenses
    .filter((e) => e.category === "CHARGES" && e.label === VIREMENT_BANQUE_LABEL)
    .reduce((sum, e) => sum + e.amount, 0)
  const cash_purchases = cash_mp_divers + cash_charges + cash_rh + cash_depot
  const ca_global = sales.reduce((sum, item) => sum + item.ca_caisse + item.ca_b2b, 0)
  const anomaly_days = sales.filter((item) => item.cash_journal_anomaly).length

  return {
    month,
    cash_sales,
    cash_movements,
    cash_mp_divers,
    mp_divers_items,
    cash_charges,
    cash_rh,
    cash_depot,
    cash_purchases,
    cash_envelope: cash_sales + cash_movements - cash_purchases,
    ca_global,
    anomaly_days,
    days_count: sales.length,
  }
}
```

Par (**noter l'ajout de `export`**) :

```typescript
export function buildCashMonthSummary(db: PilotDb, month: string) {
  const sales = monthEntries(db, month)
  const expenses = monthExpenses(db, month)
  const cash_sales = sales.reduce((sum, item) => sum + getCashSalesReference(item), 0)
  const cash_movements = sales.reduce((sum, item) => sum + getCashMovementsReference(item), 0)
  const mpDiversExpenses = expenses.filter((e) => e.category === "MP" || e.category === "AUTRE")
  const cash_mp_divers = mpDiversExpenses.reduce((sum, e) => sum + e.amount, 0)
  const mp_divers_items = Object.entries(
    mpDiversExpenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.label] = (acc[e.label] || 0) + e.amount
      return acc
    }, {})
  )
    .map(([label, amount]) => ({ label, amount }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  const cash_charges = expenses
    .filter((e) => e.category === "CHARGES" && e.label !== VIREMENT_BANQUE_LABEL)
    .reduce((sum, e) => sum + e.amount, 0)
  const cash_rh = expenses
    .filter((e) => e.category === "RH")
    .reduce((sum, e) => sum + e.amount, 0)
  const cash_depot = expenses
    .filter((e) => e.category === "CHARGES" && e.label === VIREMENT_BANQUE_LABEL)
    .reduce((sum, e) => sum + e.amount, 0)
  const cash_purchases = cash_mp_divers + cash_charges + cash_rh + cash_depot
  const ca_global = sales.reduce((sum, item) => sum + item.ca_caisse + item.ca_b2b, 0)
  const anomaly_days = sales.filter((item) => item.cash_journal_anomaly).length
  const fixed_charges_total = db.fixed_charges
    .filter((c) => isChargeActiveForMonth(c, month))
    .reduce((sum, c) => sum + c.amount, 0)
  const prime_cost_pct = ca_global > 0 ? (cash_mp_divers + cash_rh) / ca_global * 100 : 0
  const resultat_net = ca_global - cash_mp_divers - cash_rh - fixed_charges_total

  return {
    month,
    cash_sales,
    cash_movements,
    cash_mp_divers,
    mp_divers_items,
    cash_charges,
    cash_rh,
    cash_depot,
    cash_purchases,
    cash_envelope: cash_sales + cash_movements - cash_purchases,
    ca_global,
    anomaly_days,
    days_count: sales.length,
    prime_cost_pct,
    resultat_net,
  }
}
```

- [ ] **Step 5: Vérifier que les tests passent**

```bash
npm run test 2>&1 | tail -8
```

Résultat attendu : `XX passed`.

- [ ] **Step 6: Commit**

```bash
git add lib/server/analytics.ts tests/analytics.test.ts
git commit -m "feat: ajouter prime_cost_pct et resultat_net dans buildCashMonthSummary"
```

---

## Task 3: Analytics — buildLast4WeeksComparison

**Files:**
- Modify: `lib/server/analytics.ts`
- Modify: `tests/analytics.test.ts`

- [ ] **Step 1: Ajouter l'import de date-fns manquant**

Dans `lib/server/analytics.ts`, ligne 3, remplacer :

```typescript
import { eachDayOfInterval, eachWeekOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns"
```

Par :

```typescript
import { eachDayOfInterval, eachWeekOfInterval, endOfMonth, endOfWeek, format, getISOWeek, startOfMonth, startOfWeek, subWeeks } from "date-fns"
```

- [ ] **Step 2: Écrire le test qui échoue**

Ajouter à la fin de `tests/analytics.test.ts` :

```typescript
describe("buildLast4WeeksComparison", () => {
  it("retourne exactement 4 entrées ordonnées de la plus ancienne à la plus récente", () => {
    const db = makeDb({ daily_sales: [], expenses: [], fixed_charges: [] })
    const result = buildLast4WeeksComparison(db, new Date("2026-05-11"))
    expect(result).toHaveLength(4)
  })

  it("agrège le CA courant et N-1 pour chaque semaine", () => {
    const db = makeDb({
      daily_sales: [
        // Semaine courante (S19 2026 : 2026-05-11 → 2026-05-17)
        makeSale({ id: "c1", date: "2026-05-11", ca_caisse: 4000, ca_b2b: 500 }),
        makeSale({ id: "c2", date: "2026-05-13", ca_caisse: 2000, ca_b2b: 0 }),
        // Même semaine N-1 (52 semaines avant = ~2025-05-12 → 2025-05-18)
        makeSale({ id: "p1", date: "2025-05-12", ca_caisse: 3000, ca_b2b: 200 }),
      ],
      expenses: [],
      fixed_charges: [],
    })
    const result = buildLast4WeeksComparison(db, new Date("2026-05-11"))
    // result[3] = semaine la plus récente (current week)
    expect(result[3].current).toBe(6500)  // 4000+500+2000
    expect(result[3].previous).toBe(3200) // 3000+200
  })

  it("retourne 0 pour une semaine sans données", () => {
    const db = makeDb({ daily_sales: [], expenses: [], fixed_charges: [] })
    const result = buildLast4WeeksComparison(db, new Date("2026-05-11"))
    result.forEach((w) => {
      expect(w.current).toBe(0)
      expect(w.previous).toBe(0)
    })
  })
})
```

Ajouter l'import en haut du fichier de test :

```typescript
import { buildCaisseBalance, buildDashboardData, buildFinancialConsolidation, buildLast4WeeksComparison, buildWeekData, monthReporting } from "../lib/server/analytics"
```

- [ ] **Step 3: Vérifier que les tests échouent**

```bash
npm run test 2>&1 | grep "buildLast4Weeks"
```

Résultat attendu : erreur d'import ou `is not a function`.

- [ ] **Step 4: Implémenter la fonction dans analytics.ts**

Ajouter la fonction avant la ligne `export function buildDashboardData` :

```typescript
export function buildLast4WeeksComparison(
  db: PilotDb,
  referenceDate: Date = new Date()
): { label: string; current: number; previous: number }[] {
  const result: { label: string; current: number; previous: number }[] = []

  for (let i = 3; i >= 0; i--) {
    const weekAnchor = subWeeks(referenceDate, i)
    const weekStart = format(startOfWeek(weekAnchor, { weekStartsOn: 1 }), "yyyy-MM-dd")
    const weekEnd = format(endOfWeek(weekAnchor, { weekStartsOn: 1 }), "yyyy-MM-dd")
    const prevAnchor = subWeeks(referenceDate, i + 52)
    const prevStart = format(startOfWeek(prevAnchor, { weekStartsOn: 1 }), "yyyy-MM-dd")
    const prevEnd = format(endOfWeek(prevAnchor, { weekStartsOn: 1 }), "yyyy-MM-dd")
    const isoWeek = getISOWeek(startOfWeek(weekAnchor, { weekStartsOn: 1 }))

    const current = db.daily_sales
      .filter((s) => s.date >= weekStart && s.date <= weekEnd)
      .reduce((sum, s) => sum + s.ca_caisse + s.ca_b2b, 0)

    const previous = db.daily_sales
      .filter((s) => s.date >= prevStart && s.date <= prevEnd)
      .reduce((sum, s) => sum + s.ca_caisse + s.ca_b2b, 0)

    result.push({ label: `S${isoWeek}`, current, previous })
  }

  return result
}
```

- [ ] **Step 5: Vérifier que les tests passent**

```bash
npm run test 2>&1 | tail -8
```

Résultat attendu : tous les tests passent.

- [ ] **Step 6: Commit**

```bash
git add lib/server/analytics.ts tests/analytics.test.ts
git commit -m "feat: ajouter buildLast4WeeksComparison pour le graphique 4 semaines N-1"
```

---

## Task 4: Contracts — étendre les schémas

**Files:**
- Modify: `lib/contracts.ts`

- [ ] **Step 1: Étendre cashMonthSchema avec les deux nouvelles métriques**

Dans `lib/contracts.ts`, remplacer le bloc `cashMonthSchema` :

```typescript
const cashMonthSchema = z.object({
  month: z.string().catch(""),
  cash_sales: z.coerce.number().catch(0),
  cash_movements: z.coerce.number().catch(0),
  cash_mp_divers: z.coerce.number().catch(0),
  mp_divers_items: z.array(z.object({ label: z.string().catch(""), amount: z.coerce.number().catch(0) })).catch([]),
  cash_charges: z.coerce.number().catch(0),
  cash_rh: z.coerce.number().catch(0),
  cash_depot: z.coerce.number().catch(0),
  cash_purchases: z.coerce.number().catch(0),
  cash_envelope: z.coerce.number().catch(0),
  ca_global: z.coerce.number().catch(0),
  anomaly_days: z.coerce.number().catch(0),
  days_count: z.coerce.number().catch(0),
  prime_cost_pct: z.coerce.number().catch(0),
  resultat_net: z.coerce.number().catch(0),
})
```

- [ ] **Step 2: Ajouter weekComparisonSchema et l'ajouter à reportingPayloadSchema**

Ajouter après `const expenseByLabelSchema` (ligne ~253) :

```typescript
const weekComparisonItemSchema = z.object({
  label: z.string().catch(""),
  current: z.coerce.number().catch(0),
  previous: z.coerce.number().catch(0),
})
```

Dans `reportingPayloadSchema`, ajouter le champ `weekComparison` juste avant le champ `expByLabel` :

```typescript
  weekComparison: z.array(weekComparisonItemSchema).catch([]),
  expByLabel: z.array(expenseByLabelSchema).catch([]),
```

- [ ] **Step 3: Mettre à jour le default de cashMonth dans dashboardStateSchema**

Dans `dashboardStateSchema`, le bloc `cashMonth: cashMonthSchema.catch({...})` : ajouter les deux champs manquants :

```typescript
  cashMonth: cashMonthSchema.catch({
    month: "",
    cash_sales: 0,
    cash_movements: 0,
    cash_mp_divers: 0,
    mp_divers_items: [],
    cash_charges: 0,
    cash_rh: 0,
    cash_depot: 0,
    cash_purchases: 0,
    cash_envelope: 0,
    ca_global: 0,
    anomaly_days: 0,
    days_count: 0,
    prime_cost_pct: 0,
    resultat_net: 0,
  }),
```

- [ ] **Step 4: Mettre à jour le type de retour de parseDashboardState**

Dans la signature de `parseDashboardState`, le bloc `cashMonth: { ... }` : ajouter :

```typescript
  cashMonth: {
    month: string
    cash_sales: number
    cash_movements: number
    cash_mp_divers: number
    mp_divers_items: { label: string; amount: number }[]
    cash_charges: number
    cash_rh: number
    cash_depot: number
    cash_purchases: number
    cash_envelope: number
    ca_global: number
    anomaly_days: number
    days_count: number
    prime_cost_pct: number
    resultat_net: number
  }
```

- [ ] **Step 5: Vérifier le build TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Résultat attendu : aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add lib/contracts.ts
git commit -m "feat: étendre contracts — prime_cost_pct, resultat_net, weekComparison"
```

---

## Task 5: useDashboard hook — mettre à jour les types et les defaults

**Files:**
- Modify: `lib/hooks/useDashboard.ts`

- [ ] **Step 1: Mettre à jour l'interface DashboardState**

Dans `lib/hooks/useDashboard.ts`, le bloc `cashMonth` dans `interface DashboardState` :

```typescript
  cashMonth: {
    month: string
    cash_sales: number
    cash_movements: number
    cash_mp_divers: number
    mp_divers_items: { label: string; amount: number }[]
    cash_charges: number
    cash_rh: number
    cash_depot: number
    cash_purchases: number
    cash_envelope: number
    ca_global: number
    anomaly_days: number
    days_count: number
    prime_cost_pct: number
    resultat_net: number
  }
```

- [ ] **Step 2: Mettre à jour emptyCashMonth**

```typescript
const emptyCashMonth = (month: string) => ({
  month,
  cash_sales: 0,
  cash_movements: 0,
  cash_mp_divers: 0,
  mp_divers_items: [] as { label: string; amount: number }[],
  cash_charges: 0,
  cash_rh: 0,
  cash_depot: 0,
  cash_purchases: 0,
  cash_envelope: 0,
  ca_global: 0,
  anomaly_days: 0,
  days_count: 0,
  prime_cost_pct: 0,
  resultat_net: 0,
})
```

- [ ] **Step 3: Mettre à jour les deux inline cashMonth dans les setState (disabled + error)**

Chercher les deux occurrences de `cashMonth: {` dans les blocs `setState` (lignes ~151 et ~216) et ajouter `prime_cost_pct: 0, resultat_net: 0,` à chacune.

```typescript
          cashMonth: {
            month,
            cash_sales: 0,
            cash_movements: 0,
            cash_mp_divers: 0,
            mp_divers_items: [],
            cash_charges: 0,
            cash_rh: 0,
            cash_depot: 0,
            cash_purchases: 0,
            cash_envelope: 0,
            ca_global: 0,
            anomaly_days: 0,
            days_count: 0,
            prime_cost_pct: 0,
            resultat_net: 0,
          },
```

- [ ] **Step 4: Vérifier le build TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add lib/hooks/useDashboard.ts
git commit -m "feat: étendre useDashboard avec prime_cost_pct et resultat_net"
```

---

## Task 6: Hook useMonthlySuppliers (nouveau fichier)

**Files:**
- Create: `lib/hooks/useMonthlySuppliers.ts`

- [ ] **Step 1: Créer le hook**

```typescript
// lib/hooks/useMonthlySuppliers.ts
"use client"

import { useCallback, useEffect, useState } from "react"
import { parseDailyEntry } from "@/lib/contracts"

export const MONTHLY_SUPPLIERS = [
  { label: "Poulet", category: "MP" as const },
  { label: "Nor Saga", category: "MP" as const },
  { label: "Solidernet", category: "AUTRE" as const },
] as const

const SUPPLIER_LABELS = MONTHLY_SUPPLIERS.map((s) => s.label)

export function useMonthlySuppliers(month: string) {
  const date = `${month}-01`
  const [amounts, setAmounts] = useState<Record<string, number>>({
    Poulet: 0,
    "Nor Saga": 0,
    Solidernet: 0,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setAmounts({ Poulet: 0, "Nor Saga": 0, Solidernet: 0 })
    fetch(`/api/daily-entry?date=${date}`)
      .then((r) => r.json())
      .then((json) => {
        const entry = parseDailyEntry(json)
        const next: Record<string, number> = { Poulet: 0, "Nor Saga": 0, Solidernet: 0 }
        for (const exp of entry.expenses) {
          if (SUPPLIER_LABELS.includes(exp.label as typeof SUPPLIER_LABELS[number])) {
            next[exp.label] = exp.amount
          }
        }
        setAmounts(next)
      })
      .catch(() => {})
  }, [date])

  const update = (label: string, value: number) => {
    setAmounts((prev) => ({ ...prev, [label]: Math.max(0, value) }))
    setSaved(false)
  }

  const save = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/daily-entry?date=${date}`)
      const json = await res.json()
      const entry = parseDailyEntry(json)

      const otherExpenses = entry.expenses.filter(
        (e) => !SUPPLIER_LABELS.includes(e.label as typeof SUPPLIER_LABELS[number])
      )
      const supplierExpenses = MONTHLY_SUPPLIERS
        .filter((s) => (amounts[s.label] ?? 0) > 0)
        .map((s) => ({
          id: `${s.label}-${date}-virement`,
          category: s.category,
          label: s.label,
          amount: amounts[s.label] ?? 0,
        }))

      await fetch("/api/daily-entry", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...entry,
          date,
          expenses: [...otherExpenses, ...supplierExpenses],
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError("Erreur lors de l'enregistrement des fournisseurs")
    } finally {
      setSaving(false)
    }
  }, [date, amounts])

  return { amounts, update, save, saving, saved, error }
}
```

- [ ] **Step 2: Vérifier le build TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/useMonthlySuppliers.ts
git commit -m "feat: hook useMonthlySuppliers pour la saisie mensuelle des virements"
```

---

## Task 7: API Reporting — ajouter weekComparison

**Files:**
- Modify: `app/api/reporting/route.ts`

- [ ] **Step 1: Lire le fichier actuel pour identifier la ligne return**

```bash
grep -n "buildLast4\|weekComparison\|return NextResponse" app/api/reporting/route.ts
```

- [ ] **Step 2: Mettre à jour l'import de analytics**

Trouver la ligne d'import de `analytics` et ajouter `buildLast4WeeksComparison` et `buildCashMonthSummary` :

```typescript
import { buildCashMonthSummary, buildLast4WeeksComparison, buildSmartProjection, monthReporting, ... } from "@/lib/server/analytics"
```

(`buildCashMonthSummary` est désormais exportée depuis Task 2.)

- [ ] **Step 3: Ajouter weekComparison au return**

Trouver le bloc `return NextResponse.json({` et ajouter `weekComparison` :

```typescript
  return NextResponse.json({
    ...monthReporting(db, month),
    last6: buildLastSixMonths(db, month),
    weekComparison: buildLast4WeeksComparison(db),
    bankConsolidation,
    financialConsolidation,
  })
```

- [ ] **Step 4: Vérifier le build**

```bash
npx tsc --noEmit 2>&1 | head -20
npm run build 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add app/api/reporting/route.ts
git commit -m "feat: exposer weekComparison dans /api/reporting"
```

---

## Task 8: Saisie page — cartes Fournisseurs + Pilotage dans onglet Mois

**Files:**
- Modify: `app/(dashboard)/saisie/page.tsx`

- [ ] **Step 1: Ajouter l'import du hook useMonthlySuppliers**

En haut de `app/(dashboard)/saisie/page.tsx`, ajouter l'import :

```typescript
import { useMonthlySuppliers } from "@/lib/hooks/useMonthlySuppliers"
```

- [ ] **Step 2: Initialiser le hook dans le composant**

Dans la fonction `SaisiePage`, après la ligne `const { sections } = useExpenseTemplates()` (ligne ~65), ajouter :

```typescript
const { amounts: supplierAmounts, update: updateSupplier, save: saveSuppliers, saving: savingSuppliers, saved: savedSuppliers } = useMonthlySuppliers(viewMonth)
```

- [ ] **Step 3: Ajouter la carte Fournisseurs dans l'onglet Mois**

Dans le bloc `{tab === "Mois" && ...}`, après la card de navigation des mois et avant la card cashMonth existante, insérer :

```tsx
          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-alaska-dark">🏭 Fournisseurs mois (virement)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {(["Poulet", "Nor Saga", "Solidernet"] as const).map((label) => (
                <ExpenseRow
                  key={label}
                  label={label}
                  value={supplierAmounts[label] ?? 0}
                  onChange={(value) => updateSupplier(label, value)}
                />
              ))}
              <Button
                onClick={saveSuppliers}
                disabled={savingSuppliers}
                className="w-full mt-2 bg-alaska-sage text-white hover:bg-alaska-sage/90 font-semibold"
              >
                {savedSuppliers ? <><CheckCircle2 size={16} className="mr-2" />Enregistré</> : <><Save size={16} className="mr-2" />Enregistrer fournisseurs</>}
              </Button>
            </CardContent>
          </Card>
```

- [ ] **Step 4: Ajouter la carte Pilotage dans l'onglet Mois**

Juste après la card cashMonth existante (après le `</Card>` qui ferme la card avec `cash_envelope`), insérer :

```tsx
          <Card className="bg-white border border-alaska-sage-lt rounded-xl">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-alaska-dark">📊 Pilotage du mois</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pb-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-alaska-muted">Prime cost (MP + Salaires / CA)</span>
                  <span className={cn(
                    "font-playfair font-bold text-base",
                    cashMonth.prime_cost_pct < 60 ? "text-alaska-sage" :
                    cashMonth.prime_cost_pct < 65 ? "text-amber-600" : "text-red-600"
                  )}>
                    {cashMonth.ca_global > 0 ? `${cashMonth.prime_cost_pct.toFixed(1)}%` : "—"}
                  </span>
                </div>
                <div className="w-full bg-alaska-sage-lt rounded-full h-2">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all",
                      cashMonth.prime_cost_pct < 60 ? "bg-alaska-sage" :
                      cashMonth.prime_cost_pct < 65 ? "bg-amber-400" : "bg-red-500"
                    )}
                    style={{ width: `${Math.min(cashMonth.prime_cost_pct, 100).toFixed(1)}%` }}
                  />
                </div>
                <p className="text-[10px] text-alaska-muted mt-1">Norme restauration : &lt; 65 %</p>
              </div>
              <div className="border-t border-alaska-sage-lt pt-3 flex justify-between items-center">
                <div>
                  <span className="text-sm text-alaska-muted">Résultat net estimé</span>
                  <p className="text-[10px] text-alaska-muted">CA − MP − Salaires − Charges fixes</p>
                </div>
                <span className={cn(
                  "font-playfair font-bold text-lg",
                  cashMonth.resultat_net >= 0 ? "text-alaska-sage" : "text-red-600"
                )}>
                  {cashMonth.ca_global > 0
                    ? `${cashMonth.resultat_net >= 0 ? "+" : ""}${formatMAD(cashMonth.resultat_net)}`
                    : "—"}
                </span>
              </div>
            </CardContent>
          </Card>
```

- [ ] **Step 5: Vérifier le build**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add app/(dashboard)/saisie/page.tsx
git commit -m "feat: carte fournisseurs virement + pilotage prime cost dans onglet Mois saisie"
```

---

## Task 9: Reporting page — suppression blocs banque + graphique 4 semaines + prime cost

**Files:**
- Modify: `app/(dashboard)/reporting/page.tsx`

- [ ] **Step 1: Mettre à jour les imports Recharts et lucide**

Remplacer la ligne d'import Recharts actuelle :

```typescript
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
```

Par :

```typescript
import { Area, AreaChart, Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
```

Retirer `Banknote` de l'import lucide (si uniquement utilisé dans le bloc supprimé) — vérifier d'abord :

```bash
grep -n "Banknote" app/(dashboard)/reporting/page.tsx
```

Si `Banknote` n'est utilisé que dans la section "Flux cash suivi" (ligne 332), le conserver. Si uniquement dans le bloc banque supprimé, le retirer.

- [ ] **Step 2: Retirer les variables inutilisées après suppression**

Ligne 75 : `const financial = payload.financialConsolidation` — supprimer cette ligne si `financial` n'est plus utilisé après la suppression de la carte.

- [ ] **Step 3: Supprimer la card "Banque + Cash — résultat réel" (lignes 358–418)**

Supprimer le bloc complet :

```tsx
              <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-alaska-dark">Banque + Cash — résultat réel</CardTitle>
                  <CardDescription className="text-xs text-alaska-muted">Vue encaissée, hors transferts internes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!financial.has_data ? (
                    ... (tout le bloc jusqu'à)
                  )}
                </CardContent>
              </Card>
```

- [ ] **Step 4: Ajouter la card Pilotage dans la colonne droite (après Qualité consolidation)**

Après la card "Qualité consolidation" (après son `</Card>`), insérer :

```tsx
              <Card className="rounded-xl border border-alaska-sage-lt bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-alaska-dark">📊 Pilotage</CardTitle>
                  <CardDescription className="text-xs text-alaska-muted">Prime cost · Résultat net estimé</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {payload.cashFlow.cash_sales > 0 || payload.cashFlow.cash_purchases > 0 ? (
                    <>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm text-alaska-muted">Prime cost</span>
                          <span className={cn(
                            "font-playfair font-bold",
                            payload.primeCost < 60 ? "text-alaska-sage" :
                            payload.primeCost < 65 ? "text-amber-600" : "text-red-600"
                          )}>
                            {payload.primeCost.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-alaska-sage-lt rounded-full h-2">
                          <div
                            className={cn(
                              "h-2 rounded-full",
                              payload.primeCost < 60 ? "bg-alaska-sage" :
                              payload.primeCost < 65 ? "bg-amber-400" : "bg-red-500"
                            )}
                            style={{ width: `${Math.min(payload.primeCost, 100).toFixed(1)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-alaska-muted mt-1">Norme : &lt; 65 %</p>
                      </div>
                      <div className="border-t border-alaska-sage-lt pt-3 flex justify-between items-center">
                        <span className="text-sm text-alaska-muted">Résultat net estimé</span>
                        <span className={cn(
                          "font-playfair font-bold",
                          payload.resultatNet >= 0 ? "text-alaska-sage" : "text-red-600"
                        )}>
                          {payload.resultatNet >= 0 ? "+" : ""}{formatMAD(payload.resultatNet)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-alaska-muted py-2">Aucune donnée pour ce mois.</p>
                  )}
                </CardContent>
              </Card>
```

> **Note:** `payload.primeCost` et `payload.resultatNet` ne sont pas encore dans le payload. Voir Step 5.

- [ ] **Step 5: Exposer primeCost et resultatNet depuis l'API reporting**

Dans `app/api/reporting/route.ts`, ajouter ces champs au return :

```typescript
  return NextResponse.json({
    ...monthReporting(db, month),
    last6: buildLastSixMonths(db, month),
    weekComparison: buildLast4WeeksComparison(db),
    primeCost: cashMonthSummary.prime_cost_pct,
    resultatNet: cashMonthSummary.resultat_net,
    bankConsolidation,
    financialConsolidation,
  })
```

Où `cashMonthSummary` est calculé en appelant `buildCashMonthSummary` (importé depuis analytics, rendu accessible dans la route). Si `monthReporting` ne retourne pas ces champs, il faut les calculer séparément dans la route :

```typescript
// Dans app/api/reporting/route.ts, après avoir récupéré db :
const cashSummary = buildCashMonthSummary(db, month)  // à importer

return NextResponse.json({
  ...monthReporting(db, month),
  last6: buildLastSixMonths(db, month),
  weekComparison: buildLast4WeeksComparison(db),
  primeCost: cashSummary.prime_cost_pct,
  resultatNet: cashSummary.resultat_net,
  bankConsolidation,
  financialConsolidation,
})
```

Et dans `lib/contracts.ts`, ajouter dans `reportingPayloadSchema` :

```typescript
  primeCost: z.coerce.number().catch(0),
  resultatNet: z.coerce.number().catch(0),
```

- [ ] **Step 6: Ajouter le graphique 4 semaines vs N-1 (full width, avant la comparaison annuelle)**

Avant le bloc `<Card className="rounded-xl border border-alaska-sage-lt bg-white">` de la comparaison annuelle (ligne ~422), insérer :

```tsx
          <Card className="rounded-xl border border-alaska-sage-lt bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-alaska-dark">CA semaine — {year} vs {year - 1}</CardTitle>
              <CardDescription className="text-xs text-alaska-muted">4 dernières semaines comparées à la même période l&apos;an passé</CardDescription>
            </CardHeader>
            <CardContent>
              {payload.weekComparison.some((w) => w.current > 0 || w.previous > 0) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={payload.weekComparison} barCategoryGap="25%">
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7a7a6a" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#7a7a6a" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatMAD(value)} />
                    <Legend formatter={(value) => value === "current" ? String(year) : String(year - 1)} />
                    <Bar dataKey="current" name="current" fill="#4a6741" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="previous" name="previous" fill="#D1D5DB" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-6 text-center text-sm text-alaska-muted">Aucune donnée hebdomadaire disponible.</p>
              )}
            </CardContent>
          </Card>
```

- [ ] **Step 7: Vérifier le build complet**

```bash
npm run test && npm run lint && npm run build 2>&1 | tail -15
```

Résultat attendu : 0 erreur, tous les tests passent.

- [ ] **Step 8: Commit**

```bash
git add app/(dashboard)/reporting/page.tsx app/api/reporting/route.ts lib/contracts.ts
git commit -m "feat: reporting — supprimer blocs banque, ajouter graphique 4S N-1 et prime cost"
```

---

## Task 10: Vérification finale et déploiement

**Files:** aucun nouveau fichier

- [ ] **Step 1: Lancer la suite de tests complète**

```bash
npm run test
```

Résultat attendu : tous les tests passent (51+ tests).

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Résultat attendu : `No ESLint warnings or errors`.

- [ ] **Step 3: Build de production**

```bash
npm run build
```

Résultat attendu : compilation réussie, aucune erreur TypeScript.

- [ ] **Step 4: Push pour déclencher le déploiement Vercel**

```bash
git push origin main
```

- [ ] **Step 5: Vérifier en prod**
  - Ouvrir `/saisie` → onglet Mois → vérifier la card "Fournisseurs mois (virement)" avec Poulet / Nor Saga / Solidernet
  - Saisir un montant, enregistrer, recharger → montant persisté
  - Vérifier la card "Pilotage" : prime cost et résultat net
  - Ouvrir `/reporting` → vérifier l'absence de "Banque + Cash"
  - Vérifier le graphique "CA semaine — 2026 vs 2025"
