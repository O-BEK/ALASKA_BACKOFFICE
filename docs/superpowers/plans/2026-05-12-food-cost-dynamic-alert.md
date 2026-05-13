# Food Cost Dynamique & Alertes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le seuil de rentabilité dynamique (basé sur le food cost réel du mois affiché) et afficher des alertes visuelles quand le food cost est suspect (<20%) ou critique (>30%).

**Architecture:** Nouvelles fonctions utilitaires dans `lib/calculations.ts` → couche analytics les consomme pour un breakeven dynamique + expose `food_cost_status` → contrats Zod mis à jour → composant `FoodCostAlert` → branché dans 3 pages UI.

**Tech Stack:** TypeScript, Next.js 14 App Router, Zod, Tailwind CSS, Vitest

---

## File Map

| Fichier | Action |
|---------|--------|
| `lib/calculations.ts` | Ajouter constantes + `FoodCostStatus` + `getFoodCostStatus()` + `effectiveVariableCostRate()` |
| `lib/server/analytics.ts` | `liveBreakeven(db, rate?)`, `buildCashMonthSummary` + `buildMonthlyKpis` retournent `food_cost_status` + `effective_variable_rate`, breakeven dynamique |
| `lib/contracts.ts` | `cashMonthSchema` + return type `parseDashboardState` + `reportingPayloadSchema` |
| `lib/hooks/useDashboard.ts` | Interface `CashMonth` + `emptyCashMonth()` |
| `components/ui/FoodCostAlert.tsx` | Créer |
| `app/api/reporting/route.ts` | Ajouter `foodCostPct` + `foodCostStatus` à la réponse |
| `app/(dashboard)/saisie/page.tsx` | Remplacer `MiniPilotageMetric` "Coût matière" par bloc avec `FoodCostAlert` |
| `app/(dashboard)/page.tsx` | Remplacer `MetricBox` "Coût matière" par bloc avec `FoodCostAlert` |
| `app/(dashboard)/reporting/page.tsx` | Ajouter `FoodCostAlert` dans la section prime cost |
| `tests/calculations.test.ts` | Ajouter tests `getFoodCostStatus` + `effectiveVariableCostRate` |
| `tests/analytics.test.ts` | Ajouter test breakeven dynamique |

---

### Task 1: Fonctions utilitaires dans `lib/calculations.ts`

**Files:**
- Modify: `lib/calculations.ts`
- Test: `tests/calculations.test.ts`

- [ ] **Step 1: Écrire les tests qui vont échouer**

Dans `tests/calculations.test.ts`, ajouter après le describe "financial calculations" existant :

```typescript
import { describe, expect, it } from "vitest"
import {
  BREAKEVEN, calcBreakeven, calcBreakevenPct, calcMarginRate, calcNetMargin, getWeeklyBreakeven,
  getFoodCostStatus, effectiveVariableCostRate,
  FOOD_COST_SUSPECT_THRESHOLD, FOOD_COST_ALERT_THRESHOLD, FOOD_COST_FLOOR_RATE,
} from "../lib/calculations"
```

Puis ajouter à la fin du fichier :

```typescript
describe("getFoodCostStatus", () => {
  it("returns 'suspect' when pct < 20", () => {
    expect(getFoodCostStatus(0)).toBe("suspect")
    expect(getFoodCostStatus(8.6)).toBe("suspect")
    expect(getFoodCostStatus(19.9)).toBe("suspect")
  })

  it("returns 'ok' when pct is between 20 and 30 inclusive", () => {
    expect(getFoodCostStatus(20)).toBe("ok")
    expect(getFoodCostStatus(26)).toBe("ok")
    expect(getFoodCostStatus(30)).toBe("ok")
  })

  it("returns 'alert' when pct > 30", () => {
    expect(getFoodCostStatus(30.1)).toBe("alert")
    expect(getFoodCostStatus(39)).toBe("alert")
  })
})

describe("effectiveVariableCostRate", () => {
  it("returns 0.30 when food_cost < 20% (données suspectes)", () => {
    expect(effectiveVariableCostRate(0)).toBe(0.30)
    expect(effectiveVariableCostRate(8.6)).toBe(0.30)
    expect(effectiveVariableCostRate(19.9)).toBe(0.30)
  })

  it("returns floor 0.28 when food_cost is between 20% and 28%", () => {
    expect(effectiveVariableCostRate(20)).toBe(0.28)
    expect(effectiveVariableCostRate(24)).toBe(0.28)
    expect(effectiveVariableCostRate(27.9)).toBe(0.28)
  })

  it("returns actual rate when food_cost >= 28%", () => {
    expect(effectiveVariableCostRate(28)).toBeCloseTo(0.28)
    expect(effectiveVariableCostRate(31)).toBeCloseTo(0.31)
    expect(effectiveVariableCostRate(35)).toBeCloseTo(0.35)
  })
})
```

- [ ] **Step 2: Lancer pour vérifier que les tests échouent**

```bash
npx vitest run tests/calculations.test.ts --reporter=verbose
```

Expected: FAIL — `getFoodCostStatus is not a function` ou import error.

- [ ] **Step 3: Implémenter dans `lib/calculations.ts`**

Ajouter à la fin du fichier (avant la dernière ligne) :

```typescript
export const FOOD_COST_SUSPECT_THRESHOLD = 20
export const FOOD_COST_ALERT_THRESHOLD = 30
export const FOOD_COST_FLOOR_RATE = 0.28

export type FoodCostStatus = "suspect" | "ok" | "alert"

export function getFoodCostStatus(pct: number): FoodCostStatus {
  if (pct < FOOD_COST_SUSPECT_THRESHOLD) return "suspect"
  if (pct > FOOD_COST_ALERT_THRESHOLD) return "alert"
  return "ok"
}

export function effectiveVariableCostRate(foodCostPct: number): number {
  if (foodCostPct < FOOD_COST_SUSPECT_THRESHOLD) return 0.30
  return Math.max(foodCostPct / 100, FOOD_COST_FLOOR_RATE)
}
```

Mettre à jour l'import dans `tests/calculations.test.ts` ligne 2 (ajouter les nouveaux noms).

- [ ] **Step 4: Lancer pour vérifier que les tests passent**

```bash
npx vitest run tests/calculations.test.ts --reporter=verbose
```

Expected: tous les tests passent (ancien describe + 2 nouveaux).

- [ ] **Step 5: Commit**

```bash
git add lib/calculations.ts tests/calculations.test.ts
git commit -m "feat: add getFoodCostStatus and effectiveVariableCostRate utilities"
```

---

### Task 2: Couche analytics — breakeven dynamique

**Files:**
- Modify: `lib/server/analytics.ts`
- Test: `tests/analytics.test.ts`

- [ ] **Step 1: Écrire le test analytics qui va échouer**

Dans `tests/analytics.test.ts`, après le describe "buildDashboardData — dépôt banque exclu des charges", ajouter :

```typescript
describe("buildCashMonthSummary — food cost status & dynamic breakeven", () => {
  it("retourne food_cost_status 'suspect' et effectiveVariableCostRate 0.30 quand food_cost < 20%", () => {
    const db = makeDb({
      daily_sales: [makeSale({ id: "s1", date: "2026-02-15", ca_caisse: 100000, ca_b2b: 23000 })],
      expenses: [
        { id: "e1", date: "2026-02-15", category: "MP", label: "Légumes", amount: 10000, notes: "", created_by: null, updated_at: "" },
      ],
    })
    const result = buildCashMonthSummary(db, "2026-02")
    // food_cost_pct = 10000 / 123000 ≈ 8.1% → suspect
    expect(result.food_cost_pct).toBeCloseTo(8.13, 1)
    expect(result.food_cost_status).toBe("suspect")
    expect(result.effective_variable_rate).toBe(0.30)
  })

  it("retourne food_cost_status 'ok' et plancher 0.28 quand food_cost est entre 20% et 28%", () => {
    const db = makeDb({
      daily_sales: [makeSale({ id: "s1", date: "2026-04-15", ca_caisse: 100000, ca_b2b: 0 })],
      expenses: [
        { id: "e1", date: "2026-04-15", category: "MP", label: "Légumes", amount: 25000, notes: "", created_by: null, updated_at: "" },
      ],
    })
    const result = buildCashMonthSummary(db, "2026-04")
    // food_cost_pct = 25% → ok, plancher 28%
    expect(result.food_cost_status).toBe("ok")
    expect(result.effective_variable_rate).toBe(0.28)
  })

  it("retourne food_cost_status 'alert' et taux réel quand food_cost > 30%", () => {
    const db = makeDb({
      daily_sales: [makeSale({ id: "s1", date: "2026-04-15", ca_caisse: 100000, ca_b2b: 0 })],
      expenses: [
        { id: "e1", date: "2026-04-15", category: "MP", label: "Légumes", amount: 32000, notes: "", created_by: null, updated_at: "" },
      ],
    })
    const result = buildCashMonthSummary(db, "2026-04")
    // food_cost_pct = 32% → alert, taux réel 0.32
    expect(result.food_cost_status).toBe("alert")
    expect(result.effective_variable_rate).toBeCloseTo(0.32)
  })

  it("buildMonthlyKpis utilise le taux dynamique pour le breakeven", () => {
    const db = makeDb({
      daily_sales: [makeSale({ id: "s1", date: "2026-04-15", ca_caisse: 100000, ca_b2b: 0 })],
      expenses: [
        { id: "e1", date: "2026-04-15", category: "MP", label: "Légumes", amount: 32000, notes: "", created_by: null, updated_at: "" },
      ],
      fixed_charges: [makeFixedCharge({ amount: 72000, is_active: true, start_date: "2026-01-01", end_date: null })],
    })
    // food_cost = 32% → effectiveRate = 0.32 → breakeven = 72000 / (1 - 0.32) = 105882
    const result = buildDashboardData(db, "2026-04")
    expect(result.kpis.breakeven).toBeCloseTo(72000 / (1 - 0.32), 0)
    // Vérifie que ce n'est PAS le calcul avec 0.28 fixe
    expect(result.kpis.breakeven).not.toBeCloseTo(72000 / (1 - 0.28), 0)
  })
})
```

- [ ] **Step 2: Lancer pour vérifier que les tests échouent**

```bash
npx vitest run tests/analytics.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — `food_cost_status` et `effective_variable_rate` undefined.

- [ ] **Step 3: Mettre à jour l'import dans `lib/server/analytics.ts` ligne 7**

Remplacer :
```typescript
import { BREAKEVEN, CAISSE_RESERVE, calcBreakeven, calcBreakevenPct, calcMarginRate, calcNetMargin, getWeeklyBreakeven } from "@/lib/calculations"
```
Par :
```typescript
import { BREAKEVEN, CAISSE_RESERVE, calcBreakeven, calcBreakevenPct, calcMarginRate, calcNetMargin, effectiveVariableCostRate, getFoodCostStatus, getWeeklyBreakeven } from "@/lib/calculations"
import type { FoodCostStatus } from "@/lib/calculations"
```

- [ ] **Step 4: Mettre à jour `liveBreakeven` (lignes 14-19)**

Remplacer :
```typescript
function liveBreakeven(db: PilotDb): number {
  const total = db.fixed_charges
    .filter((c) => c.is_active)
    .reduce((sum, c) => sum + c.amount, 0)
  return total > 0 ? calcBreakeven(total) : BREAKEVEN
}
```
Par :
```typescript
function liveBreakeven(db: PilotDb, variableCostRate = VARIABLE_COST_RATE): number {
  const total = db.fixed_charges
    .filter((c) => c.is_active)
    .reduce((sum, c) => sum + c.amount, 0)
  return total > 0 ? calcBreakeven(total, variableCostRate) : calcBreakeven(FIXED_CHARGES_TOTAL, variableCostRate)
}
```

Ajouter `VARIABLE_COST_RATE, FIXED_CHARGES_TOTAL` à l'import de `@/lib/calculations`.

- [ ] **Step 5: Mettre à jour `buildCashMonthSummary` — ajouter 2 champs dans le return**

Après la ligne `const food_cost_pct = ca_global > 0 ? (cash_mp_only / ca_global) * 100 : 0` (ligne ~299), ajouter :

```typescript
const food_cost_status: FoodCostStatus = getFoodCostStatus(food_cost_pct)
const effective_variable_rate = effectiveVariableCostRate(food_cost_pct)
```

Ajouter dans le `return { ... }` après `food_cost_pct,` :

```typescript
food_cost_status,
effective_variable_rate,
```

- [ ] **Step 6: Mettre à jour `buildMonthlyKpis` — breakeven dynamique**

Dans `buildMonthlyKpis` (lignes 329-359), après `const ca_total = ca_caisse + ca_b2b`, ajouter :

```typescript
const cash_mp_only_kpis = expenses.filter((e) => e.category === "MP").reduce((sum, e) => sum + e.amount, 0)
const food_cost_pct_kpis = ca_total > 0 ? (cash_mp_only_kpis / ca_total) * 100 : 0
const effectiveRate = effectiveVariableCostRate(food_cost_pct_kpis)
```

Remplacer :
```typescript
const breakeven = liveBreakeven(db)
```
Par :
```typescript
const breakeven = liveBreakeven(db, effectiveRate)
```

- [ ] **Step 7: Lancer pour vérifier que les tests passent**

```bash
npx vitest run tests/analytics.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: tous les tests passent.

- [ ] **Step 8: Commit**

```bash
git add lib/server/analytics.ts tests/analytics.test.ts
git commit -m "feat: dynamic breakeven using actual food_cost_pct per month"
```

---

### Task 3: Contrats Zod + hook useDashboard

**Files:**
- Modify: `lib/contracts.ts`
- Modify: `lib/hooks/useDashboard.ts`

- [ ] **Step 1: Mettre à jour `cashMonthSchema` dans `lib/contracts.ts`**

Après `resultat_net: z.coerce.number().catch(0),` (ligne ~115), ajouter :

```typescript
food_cost_status: z.enum(["suspect", "ok", "alert"]).catch("ok"),
effective_variable_rate: z.coerce.number().catch(0.28),
```

- [ ] **Step 2: Mettre à jour le `.catch({})` du `cashMonth` dans `dashboardStateSchema`**

Dans l'objet default de `cashMonth: cashMonthSchema.catch({ ... })` (lignes 162-183), ajouter après `resultat_net: 0,` :

```typescript
food_cost_status: "ok" as const,
effective_variable_rate: 0.28,
```

- [ ] **Step 3: Mettre à jour le type de retour de `parseDashboardState`**

Dans l'interface du type de retour, dans `cashMonth: { ... }`, après `resultat_net: number`, ajouter :

```typescript
food_cost_status: "suspect" | "ok" | "alert"
effective_variable_rate: number
```

- [ ] **Step 4: Mettre à jour `lib/hooks/useDashboard.ts`**

Dans l'interface `CashMonth` (après `resultat_net: number`), ajouter :

```typescript
food_cost_status: "suspect" | "ok" | "alert"
effective_variable_rate: number
```

Trouver la fonction `emptyCashMonth()` et après `resultat_net: 0,`, ajouter :

```typescript
food_cost_status: "ok" as const,
effective_variable_rate: 0.28,
```

- [ ] **Step 5: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 erreurs.

- [ ] **Step 6: Commit**

```bash
git add lib/contracts.ts lib/hooks/useDashboard.ts
git commit -m "feat: add food_cost_status and effective_variable_rate to contracts and hook"
```

---

### Task 4: Composant `FoodCostAlert`

**Files:**
- Create: `components/ui/FoodCostAlert.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// components/ui/FoodCostAlert.tsx
"use client"

import { cn } from "@/lib/utils"
import { getFoodCostStatus } from "@/lib/calculations"
import type { FoodCostStatus } from "@/lib/calculations"

interface FoodCostAlertProps {
  pct: number
  className?: string
}

export function FoodCostAlert({ pct, className }: FoodCostAlertProps) {
  if (pct === 0) {
    return <span className={cn("text-sm font-semibold text-alaska-muted", className)}>—</span>
  }

  const status: FoodCostStatus = getFoodCostStatus(pct)

  return (
    <div className={cn("flex flex-col", className)}>
      <span className={cn(
        "text-sm font-semibold",
        status === "ok" ? "text-green-600" :
        status === "alert" ? "text-red-600" :
        "text-alaska-muted"
      )}>
        {pct.toFixed(1)} %
      </span>
      {status === "suspect" && (
        <span className="text-[10px] text-alaska-muted leading-tight">⚠️ Achats incomplets</span>
      )}
      {status === "alert" && (
        <span className="text-[10px] text-red-500 leading-tight">🚨 Food cost critique</span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 erreurs.

- [ ] **Step 3: Commit**

```bash
git add components/ui/FoodCostAlert.tsx
git commit -m "feat: add FoodCostAlert component with suspect/ok/alert states"
```

---

### Task 5: Reporter food_cost vers la page Reporting

**Files:**
- Modify: `app/api/reporting/route.ts`
- Modify: `lib/contracts.ts` (section `reportingPayloadSchema`)

- [ ] **Step 1: Mettre à jour `app/api/reporting/route.ts`**

Trouver les lignes (~61-62) :
```typescript
primeCost: cashSummary.prime_cost_pct,
resultatNet: cashSummary.resultat_net,
```

Remplacer par :
```typescript
primeCost: cashSummary.prime_cost_pct,
resultatNet: cashSummary.resultat_net,
foodCostPct: cashSummary.food_cost_pct,
foodCostStatus: cashSummary.food_cost_status,
```

- [ ] **Step 2: Mettre à jour `reportingPayloadSchema` dans `lib/contracts.ts`**

Trouver :
```typescript
primeCost: z.coerce.number().catch(0),
resultatNet: z.coerce.number().catch(0),
```

Remplacer par :
```typescript
primeCost: z.coerce.number().catch(0),
resultatNet: z.coerce.number().catch(0),
foodCostPct: z.coerce.number().catch(0),
foodCostStatus: z.enum(["suspect", "ok", "alert"]).catch("ok"),
```

- [ ] **Step 3: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 erreurs.

- [ ] **Step 4: Commit**

```bash
git add app/api/reporting/route.ts lib/contracts.ts
git commit -m "feat: expose foodCostPct and foodCostStatus in reporting API"
```

---

### Task 6: Brancher FoodCostAlert dans les 3 pages UI

**Files:**
- Modify: `app/(dashboard)/saisie/page.tsx`
- Modify: `app/(dashboard)/page.tsx`
- Modify: `app/(dashboard)/reporting/page.tsx`

- [ ] **Step 1: Mettre à jour `app/(dashboard)/saisie/page.tsx`**

Ajouter l'import en haut du fichier (après les imports existants) :
```typescript
import { FoodCostAlert } from "@/components/ui/FoodCostAlert"
```

Trouver la ligne ~509 :
```tsx
<MiniPilotageMetric label="Coût matière" value={cashMonth.food_cost_pct > 0 ? `${cashMonth.food_cost_pct.toFixed(1)} %` : "—"} />
```

Remplacer par :
```tsx
<div className="rounded-lg border border-alaska-sage-lt bg-alaska-sage-lt/20 px-3 py-2">
  <p className="text-[10px] uppercase tracking-wide text-alaska-muted">Coût matière</p>
  <FoodCostAlert pct={cashMonth.food_cost_pct} className="mt-0.5" />
</div>
```

- [ ] **Step 2: Mettre à jour `app/(dashboard)/page.tsx`**

Ajouter l'import en haut du fichier :
```typescript
import { FoodCostAlert } from "@/components/ui/FoodCostAlert"
```

Trouver les lignes ~338-342 :
```tsx
<MetricBox
  label="Coût matière"
  value={cashMonth.food_cost_pct > 0 ? `${cashMonth.food_cost_pct.toFixed(1)}%` : "—"}
  tone="text-alaska-dark"
/>
```

Remplacer par :
```tsx
<div className="flex flex-col gap-0.5">
  <span className="text-xs text-alaska-muted">Coût matière</span>
  <FoodCostAlert pct={cashMonth.food_cost_pct} />
</div>
```

- [ ] **Step 3: Mettre à jour `app/(dashboard)/reporting/page.tsx`**

Ajouter l'import en haut du fichier :
```typescript
import { FoodCostAlert } from "@/components/ui/FoodCostAlert"
```

Trouver le bloc prime cost (autour de la ligne 411-431) qui ressemble à :
```tsx
<span className="text-xs uppercase tracking-wide text-alaska-muted">Prime cost</span>
<span className={cn("text-sm font-bold", ...)}>
  {payload.primeCost > 0 ? `${payload.primeCost.toFixed(1)} %` : "—"}
</span>
```

Ajouter APRÈS ce bloc prime cost, avant la barre de progression ou le résultat net :
```tsx
<div className="flex justify-between items-start pt-1">
  <span className="text-xs uppercase tracking-wide text-alaska-muted">Coût matière</span>
  <FoodCostAlert pct={payload.foodCostPct} className="items-end" />
</div>
```

- [ ] **Step 4: Vérifier TypeScript + lint + tests**

```bash
npx tsc --noEmit && npm run lint && npx vitest run --reporter=verbose 2>&1 | tail -10
```

Expected: 0 erreurs TypeScript, 0 lint, tous les tests passent.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/saisie/page.tsx" "app/(dashboard)/page.tsx" "app/(dashboard)/reporting/page.tsx"
git commit -m "feat: wire FoodCostAlert in saisie, dashboard and reporting pages"
```

---

### Task 7: Vérification finale

**Files:** Aucun fichier à modifier.

- [ ] **Step 1: Suite complète**

```bash
npm run test && npm run lint && npx tsc --noEmit
```

Expected:
- `npm run test` → 67+/67 tests passent (4 nouveaux : 3 calculations + 4 analytics)
- `npm run lint` → 0 erreur
- `npx tsc --noEmit` → 0 erreur

- [ ] **Step 2: Vérification des scénarios visuels (si serveur dev disponible)**

| Mois | food_cost_pct attendu | Affichage attendu |
|------|-----------------------|-------------------|
| Février 2026 | ~8% | ⚠️ Achats incomplets (gris) |
| Avril 2026 | ~26% | ✅ vert |
| Tout mois > 30% | >30% | 🚨 Food cost critique (rouge) |

Vérifier aussi que le seuil de rentabilité du dashboard change selon le mois sélectionné.
