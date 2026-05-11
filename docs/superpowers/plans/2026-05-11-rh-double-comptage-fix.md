# Fix Double-Comptage RH — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger le double-comptage des salaires dans `prime_cost_pct` et `resultat_net` quand un employé est payé partiellement en cash (saisi dans `/saisie`) et a déjà un salaire total dans `/charges`.

**Architecture:** Modification chirurgicale de `buildCashMonthSummary` dans `lib/server/analytics.ts`. On distingue les dépenses RH cash qui correspondent à un employé déjà couvert par `fixed_charges` (→ ignorées dans `resultat_net`, couvertes par la charge fixe) de celles sans entrée dans `/charges` (intérimaires, paiements ponctuels → comptées normalement). La correspondance se fait par `expenses.label === fixed_charges.name`, ce qui est fiable car `/saisie` stocke `staffMember.name` comme label.

**Tech Stack:** TypeScript, Vitest, date-fns (déjà présents)

---

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| `lib/server/analytics.ts` | Modifier `buildCashMonthSummary` (lignes 250–301) |
| `tests/analytics.test.ts` | Étendre `makeFixedCharge` + ajouter 3 tests |

---

## Task 1 : Corriger `buildCashMonthSummary` (TDD)

**Files:**
- Modify: `lib/server/analytics.ts:250-301`
- Modify: `tests/analytics.test.ts`

### Step 1 — Étendre `makeFixedCharge` pour accepter `name` et `is_staff`

Dans `tests/analytics.test.ts`, remplacer la définition actuelle de `makeFixedCharge` (ligne 320) :

```typescript
// AVANT
function makeFixedCharge(overrides: { amount: number; is_active: boolean; start_date: string; end_date: string | null }): FixedCharge {
  return {
    id: Math.random().toString(),
    name: "test charge",
    category: "DIVERS",
    amount: overrides.amount,
    type: "fixed",
    payment_day: null,
    is_staff: false,
    is_active: overrides.is_active,
    start_date: overrides.start_date,
    end_date: overrides.end_date,
  }
}
```

```typescript
// APRÈS
function makeFixedCharge(overrides: {
  name?: string
  amount: number
  is_staff?: boolean
  is_active: boolean
  start_date: string
  end_date: string | null
}): FixedCharge {
  return {
    id: Math.random().toString(),
    name: overrides.name ?? "test charge",
    category: "DIVERS",
    amount: overrides.amount,
    type: "fixed",
    payment_day: null,
    is_staff: overrides.is_staff ?? false,
    is_active: overrides.is_active,
    start_date: overrides.start_date,
    end_date: overrides.end_date,
  }
}
```

- [ ] Appliquer ce remplacement dans `tests/analytics.test.ts`

### Step 2 — Vérifier que les tests existants passent encore

```
npm run test -- --reporter=verbose 2>&1 | tail -20
```

Attendu : 58/58 tests passent (les tests existants de `makeFixedCharge` n'utilisaient pas `name` ni `is_staff`, les nouveaux paramètres ont des valeurs par défaut).

- [ ] Lancer et vérifier

### Step 3 — Écrire les 3 tests qui échouent

Dans `tests/analytics.test.ts`, ajouter un nouveau describe block juste après le describe `"buildCashMonthSummary — prime cost & résultat net"` (après la ligne `})` qui le ferme) :

```typescript
describe("buildCashMonthSummary — RH sans double comptage", () => {
  it("n'inclut pas le cash RH dans resultat_net si l'employé est dans fixed_charges", () => {
    // Employé "Ahmed" : salaire total 5 000 dans /charges, 2 000 payés en cash dans /saisie
    const db = makeDb({
      daily_sales: [makeSale({ id: "s1", date: "2026-05-10", ca_caisse: 10000, ca_b2b: 0 })],
      expenses: [
        makeExpenseRecord("2026-05-10", { category: "RH", amount: 2000, label: "Ahmed" }),
      ],
      fixed_charges: [
        makeFixedCharge({ name: "Ahmed", amount: 5000, is_staff: true, is_active: true, start_date: "2026-01-01", end_date: null }),
      ],
    })
    const result = buildCashMonthSummary(db, "2026-05")
    // resultat_net = 10000 - 0(mp) - 0(rh_not_in_fixed) - 5000(fixed) = 5000
    expect(result.resultat_net).toBe(5000)
    // prime_cost = total_rh(5000) / ca(10000) = 50%
    expect(result.prime_cost_pct).toBeCloseTo(50)
  })

  it("compte les paiements RH cash sans fiche /charges (intérimaires)", () => {
    // Intérimaire sans entrée dans /charges
    const db = makeDb({
      daily_sales: [makeSale({ id: "s1", date: "2026-05-10", ca_caisse: 10000, ca_b2b: 0 })],
      expenses: [
        makeExpenseRecord("2026-05-10", { category: "RH", amount: 800, label: "Intérimaire" }),
      ],
      fixed_charges: [],
    })
    const result = buildCashMonthSummary(db, "2026-05")
    // rh_not_in_fixed = 800, aucun staff dans fixed_charges
    expect(result.resultat_net).toBe(9200) // 10000 - 800
    expect(result.prime_cost_pct).toBeCloseTo(8) // 800/10000*100
  })

  it("inclut les salaires 100% virement via fixed_charges dans prime_cost", () => {
    // Employée "Sara" payée uniquement par virement, aucun cash saisi dans /saisie
    const db = makeDb({
      daily_sales: [makeSale({ id: "s1", date: "2026-05-10", ca_caisse: 10000, ca_b2b: 0 })],
      expenses: [],
      fixed_charges: [
        makeFixedCharge({ name: "Sara", amount: 4000, is_staff: true, is_active: true, start_date: "2026-01-01", end_date: null }),
      ],
    })
    const result = buildCashMonthSummary(db, "2026-05")
    expect(result.resultat_net).toBe(6000) // 10000 - 4000
    expect(result.prime_cost_pct).toBeCloseTo(40) // 4000/10000*100
  })
})
```

- [ ] Ajouter ce bloc dans `tests/analytics.test.ts`

### Step 4 — Vérifier que les 3 nouveaux tests échouent

```
npm run test -- --reporter=verbose 2>&1 | tail -20
```

Attendu : 58 passent, 3 échouent avec des valeurs incorrectes (double-comptage visible).

- [ ] Lancer et confirmer l'échec des 3 nouveaux tests

### Step 5 — Implémenter le fix dans `buildCashMonthSummary`

Dans `lib/server/analytics.ts`, remplacer les lignes 278–282 (de `const fixed_charges_total` à `const resultat_net`) :

```typescript
// AVANT (lignes 278–282)
  const fixed_charges_total = db.fixed_charges
    .filter((c) => isChargeActiveForMonth(c, month))
    .reduce((sum, c) => sum + c.amount, 0)
  const prime_cost_pct = ca_global > 0 ? (cash_mp_divers + cash_rh) / ca_global * 100 : 0
  const resultat_net = ca_global - cash_mp_divers - cash_rh - fixed_charges_total
```

```typescript
// APRÈS
  const fixed_charges_total = db.fixed_charges
    .filter((c) => isChargeActiveForMonth(c, month))
    .reduce((sum, c) => sum + c.amount, 0)
  // Évite le double-comptage : les charges personnel couvrent déjà le salaire total.
  // Seules les dépenses RH cash sans fiche /charges (intérimaires) s'ajoutent en plus.
  const activeStaffCharges = db.fixed_charges.filter(
    (c) => isChargeActiveForMonth(c, month) && c.is_staff
  )
  const staffNamesInCharges = new Set(activeStaffCharges.map((c) => c.name))
  const rh_in_fixed = activeStaffCharges.reduce((sum, c) => sum + c.amount, 0)
  const rh_not_in_fixed = expenses
    .filter((e) => e.category === "RH" && !staffNamesInCharges.has(e.label))
    .reduce((sum, e) => sum + e.amount, 0)
  const total_rh = rh_in_fixed + rh_not_in_fixed
  const prime_cost_pct = ca_global > 0 ? (cash_mp_divers + total_rh) / ca_global * 100 : 0
  const resultat_net = ca_global - cash_mp_divers - rh_not_in_fixed - fixed_charges_total
```

Note : `cash_rh` reste inchangé plus haut dans la fonction — il continue d'alimenter `cash_purchases` et `cash_envelope` (flux de trésorerie caisse, non affecté par ce fix).

- [ ] Appliquer ce remplacement dans `lib/server/analytics.ts`

### Step 6 — Vérifier que tous les tests passent

```
npm run test -- --reporter=verbose 2>&1 | tail -20
```

Attendu : **61/61 tests passent** (58 existants + 3 nouveaux).

- [ ] Lancer et confirmer

### Step 7 — Lint et build

```
npm run lint 2>&1 | tail -5
npx tsc --noEmit 2>&1 | head -10
```

Attendu : aucune erreur.

- [ ] Lancer et confirmer

### Step 8 — Commit

```
git add lib/server/analytics.ts tests/analytics.test.ts
git commit -m "fix: corriger double-comptage RH dans prime_cost et resultat_net"
```

- [ ] Committer

---

## Task 2 : Vérification finale et push

**Files:** aucun

### Step 1 — Lancer la suite complète

```
npm run test 2>&1 | tail -5
npm run lint 2>&1 | tail -3
npm run build 2>&1 | tail -10
```

Attendu : tests OK, lint OK, build OK (pas de nouvelle page, taille de bundle stable).

- [ ] Confirmer les 3 passes

### Step 2 — Push vers main (déploiement Vercel)

```
git push origin main
```

- [ ] Push et confirmer
