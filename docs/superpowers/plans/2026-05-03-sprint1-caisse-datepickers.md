# Sprint 1 — Mois split + Date pickers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Décomposer "Achats cash" en 4 lignes dans l'onglet Mois, ajouter un date picker de navigation dans la caisse, et corriger le centrage du date picker dans l'import CSV.

**Architecture:** Changements additifs sur l'analytics server-side (`buildCashMonthSummary`), propagation via le contrat Zod et le hook `useDashboard`, puis mise à jour de l'UI. Aucune migration DB nécessaire — les catégories existent déjà dans la table `expenses`.

**Tech Stack:** TypeScript, Next.js 14 App Router, Zod, Vitest, Tailwind CSS, date-fns

---

## Fichiers modifiés

| Fichier | Rôle du changement |
|---|---|
| `lib/server/analytics.ts` | `buildCashMonthSummary()` retourne 4 champs à la place de `cash_purchases` |
| `lib/contracts.ts` | `cashMonthSchema` + type `DashboardData.cashMonth` : +4 champs |
| `lib/hooks/useDashboard.ts` | Type + 3 valeurs par défaut : +4 champs |
| `app/(dashboard)/saisie/page.tsx` | Mois tab : 4 lignes + date picker navigation |
| `app/(dashboard)/import/page.tsx` | Centrage CSS date pickers |
| `tests/analytics.test.ts` | Nouveau test pour le split |

---

## Task 1 : Ajouter le test pour le split cashMonth

**Fichiers :**
- Modify: `tests/analytics.test.ts`

- [ ] **Step 1 : Ajouter le test (il doit échouer)**

Ouvrir `tests/analytics.test.ts`. Après le dernier `describe`, ajouter :

```typescript
describe("buildDashboardData cashMonth split", () => {
  it("splits expenses into 4 breakdown fields", () => {
    const db = makeDb({
      daily_sales: [makeSale({ id: "s1", date: "2026-01-15", ca_caisse: 5000 })],
      expenses: [
        { id: "e1", date: "2026-01-15", category: "MP",      label: "Poissonnier",    amount: 1000, notes: "", created_by: null, updated_at: "" },
        { id: "e2", date: "2026-01-15", category: "AUTRE",   label: "Divers",          amount: 200,  notes: "", created_by: null, updated_at: "" },
        { id: "e3", date: "2026-01-15", category: "CHARGES", label: "Loyer",           amount: 800,  notes: "", created_by: null, updated_at: "" },
        { id: "e4", date: "2026-01-15", category: "CHARGES", label: "Virement banque", amount: 2000, notes: "", created_by: null, updated_at: "" },
        { id: "e5", date: "2026-01-15", category: "RH",      label: "Ramzi",           amount: 1500, notes: "", created_by: null, updated_at: "" },
      ],
    })
    const result = buildDashboardData(db, "2026-01")
    expect(result.cashMonth.cash_mp_divers).toBe(1200)  // MP 1000 + AUTRE 200
    expect(result.cashMonth.cash_charges).toBe(800)     // CHARGES hors "Virement banque"
    expect(result.cashMonth.cash_rh).toBe(1500)         // RH uniquement
    expect(result.cashMonth.cash_depot).toBe(2000)      // CHARGES label "Virement banque"
    expect(result.cashMonth.cash_purchases).toBe(5500)  // somme totale (backward compat)
    expect(result.cashMonth.cash_envelope).toBe(-500)   // 5000 - 5500
  })
})
```

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
npm run test -- --reporter=verbose tests/analytics.test.ts
```

Résultat attendu : FAIL sur `cash_mp_divers is not a property` ou `undefined`.

---

## Task 2 : Mettre à jour `buildCashMonthSummary` dans analytics.ts

**Fichiers :**
- Modify: `lib/server/analytics.ts` (fonction `buildCashMonthSummary`, lignes 246-265)

- [ ] **Step 1 : Remplacer le corps de la fonction**

Remplacer la fonction `buildCashMonthSummary` (actuellement lignes 246-265) par :

```typescript
function buildCashMonthSummary(db: PilotDb, month: string) {
  const sales = monthEntries(db, month)
  const expenses = monthExpenses(db, month)
  const cash_sales = sales.reduce((sum, item) => sum + getCashSalesReference(item), 0)
  const cash_movements = sales.reduce((sum, item) => sum + getCashMovementsReference(item), 0)
  const cash_mp_divers = expenses
    .filter((e) => e.category === "MP" || e.category === "AUTRE")
    .reduce((sum, e) => sum + e.amount, 0)
  const cash_charges = expenses
    .filter((e) => e.category === "CHARGES" && e.label !== "Virement banque")
    .reduce((sum, e) => sum + e.amount, 0)
  const cash_rh = expenses
    .filter((e) => e.category === "RH")
    .reduce((sum, e) => sum + e.amount, 0)
  const cash_depot = expenses
    .filter((e) => e.category === "CHARGES" && e.label === "Virement banque")
    .reduce((sum, e) => sum + e.amount, 0)
  const cash_purchases = cash_mp_divers + cash_charges + cash_rh + cash_depot
  const ca_global = sales.reduce((sum, item) => sum + item.ca_caisse + item.ca_b2b, 0)
  const anomaly_days = sales.filter((item) => item.cash_journal_anomaly).length

  return {
    month,
    cash_sales,
    cash_movements,
    cash_mp_divers,
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

Note : `cash_purchases` est conservé comme somme totale (utilisé par `monthReporting` → `cashFlow` dans le reporting).

- [ ] **Step 2 : Relancer le test**

```bash
npm run test -- --reporter=verbose tests/analytics.test.ts
```

Résultat attendu : PASS sur le nouveau test + tous les tests existants PASS.

- [ ] **Step 3 : Commit**

```bash
git add lib/server/analytics.ts tests/analytics.test.ts
git commit -m "feat: split buildCashMonthSummary into 4 expense breakdown fields"
```

---

## Task 3 : Mettre à jour le contrat Zod `cashMonthSchema` dans contracts.ts

**Fichiers :**
- Modify: `lib/contracts.ts` (lignes 95-104 et 150-159 et type lignes ~488-497)

- [ ] **Step 1 : Mettre à jour `cashMonthSchema`**

Trouver `cashMonthSchema` (lignes 95-104) et remplacer par :

```typescript
const cashMonthSchema = z.object({
  month: z.string().catch(""),
  cash_sales: z.coerce.number().catch(0),
  cash_movements: z.coerce.number().catch(0),
  cash_mp_divers: z.coerce.number().catch(0),
  cash_charges: z.coerce.number().catch(0),
  cash_rh: z.coerce.number().catch(0),
  cash_depot: z.coerce.number().catch(0),
  cash_purchases: z.coerce.number().catch(0),
  cash_envelope: z.coerce.number().catch(0),
  ca_global: z.coerce.number().catch(0),
  anomaly_days: z.coerce.number().catch(0),
  days_count: z.coerce.number().catch(0),
})
```

- [ ] **Step 2 : Mettre à jour la valeur par défaut dans le schéma de parsing**

Chercher `.catch({` juste après `cashMonth: cashMonthSchema` (environ ligne 150) — il y a 3 occurrences de valeurs par défaut `cashMonth` dans le fichier. Les mettre toutes à jour avec les nouveaux champs :

```typescript
cashMonth: cashMonthSchema.catch({
  month: "",
  cash_sales: 0,
  cash_movements: 0,
  cash_mp_divers: 0,
  cash_charges: 0,
  cash_rh: 0,
  cash_depot: 0,
  cash_purchases: 0,
  cash_envelope: 0,
  ca_global: 0,
  anomaly_days: 0,
  days_count: 0,
}),
```

- [ ] **Step 3 : Mettre à jour le type TypeScript `DashboardData`**

Chercher l'interface/type qui définit `cashMonth` (environ ligne 488) et ajouter les 4 champs :

```typescript
cashMonth: {
  month: string
  cash_sales: number
  cash_movements: number
  cash_mp_divers: number
  cash_charges: number
  cash_rh: number
  cash_depot: number
  cash_purchases: number
  cash_envelope: number
  ca_global: number
  anomaly_days: number
  days_count: number
}
```

- [ ] **Step 4 : Vérifier que TypeScript compile**

```bash
npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add lib/contracts.ts
git commit -m "feat: update cashMonthSchema with 4 expense breakdown fields"
```

---

## Task 4 : Mettre à jour `useDashboard.ts`

**Fichiers :**
- Modify: `lib/hooks/useDashboard.ts`

- [ ] **Step 1 : Mettre à jour le type du hook**

Trouver la déclaration du type de `cashMonth` dans le hook (environ ligne 31-38) et ajouter les 4 champs :

```typescript
cashMonth: {
  month: string
  cash_sales: number
  cash_movements: number
  cash_mp_divers: number
  cash_charges: number
  cash_rh: number
  cash_depot: number
  cash_purchases: number
  cash_envelope: number
  ca_global: number
  anomaly_days: number
}
```

- [ ] **Step 2 : Mettre à jour les 3 valeurs par défaut**

Il y a 3 objets `cashMonth` par défaut dans le hook (lignes ~97-104, ~141-148, ~202-209). Les mettre tous à jour :

```typescript
cashMonth: {
  month,
  cash_sales: 0,
  cash_movements: 0,
  cash_mp_divers: 0,
  cash_charges: 0,
  cash_rh: 0,
  cash_depot: 0,
  cash_purchases: 0,
  cash_envelope: 0,
  ca_global: 0,
  anomaly_days: 0,
},
```

- [ ] **Step 3 : Vérifier**

```bash
npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add lib/hooks/useDashboard.ts
git commit -m "feat: update useDashboard cashMonth type with 4 breakdown fields"
```

---

## Task 5 : Mettre à jour l'onglet Mois dans `saisie/page.tsx`

**Fichiers :**
- Modify: `app/(dashboard)/saisie/page.tsx` (section `tab === "Mois"`, lignes 326-332)

- [ ] **Step 1 : Remplacer la ligne "Achats cash" par 4 lignes**

Dans le bloc `{tab === "Mois" && ...}`, trouver la `<Card>` qui contient les lignes cash et remplacer la section à partir de `<div className="flex justify-between">` avec `Achats cash` :

Remplacer ce bloc :

```tsx
<div className="flex justify-between">
  <span className="text-sm text-alaska-muted">Achats cash</span>
  <span className="font-playfair font-bold text-orange-600">{formatMAD(cashMonth.cash_purchases)}</span>
</div>
```

Par :

```tsx
<div className="flex justify-between">
  <span className="text-sm text-alaska-muted">Achats MP & divers</span>
  <span className="font-playfair font-bold text-orange-600">{formatMAD(cashMonth.cash_mp_divers)}</span>
</div>
<div className="flex justify-between">
  <span className="text-sm text-alaska-muted">Charges cash</span>
  <span className="font-playfair font-bold text-orange-600">{formatMAD(cashMonth.cash_charges)}</span>
</div>
<div className="flex justify-between">
  <span className="text-sm text-alaska-muted">Salaires cash</span>
  <span className="font-playfair font-bold text-orange-600">{formatMAD(cashMonth.cash_rh)}</span>
</div>
<div className="flex justify-between">
  <span className="text-sm text-alaska-muted">Dépôt cash banque</span>
  <span className="font-playfair font-bold text-orange-600">{formatMAD(cashMonth.cash_depot)}</span>
</div>
```

- [ ] **Step 2 : Vérifier build**

```bash
npm run build
```

Résultat attendu : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add app/\(dashboard\)/saisie/page.tsx
git commit -m "feat: split Mois tab cash_purchases into 4 breakdown lines"
```

---

## Task 6 : Ajouter le date picker de navigation dans la caisse

**Fichiers :**
- Modify: `app/(dashboard)/saisie/page.tsx` (section navigation jour, lignes 146-158)

- [ ] **Step 1 : Ajouter l'input date sous les flèches**

Trouver le bloc navigation dans le `tab === "Caisse"` :

```tsx
<button onClick={() => setActiveDate(today)} className="w-full mt-2 text-xs text-alaska-sage hover:underline">Aujourd&apos;hui</button>
```

Ajouter **avant** ce bouton :

```tsx
<input
  type="date"
  value={format(date, "yyyy-MM-dd")}
  onChange={(e) => { if (e.target.value) setActiveDate(parseISO(e.target.value)) }}
  className="w-full mt-2 border border-alaska-sage-lt rounded-lg px-3 py-1.5 text-sm text-center text-alaska-dark focus:outline-none focus:ring-1 focus:ring-alaska-sage"
/>
```

Note : `parseISO` est déjà importé depuis `date-fns` en ligne 3.

- [ ] **Step 2 : Vérifier build**

```bash
npm run build
```

Résultat attendu : aucune erreur.

- [ ] **Step 3 : Tester manuellement**

Lancer `npm run dev`, aller sur `/saisie`, utiliser le date picker pour sauter au 1er du mois — vérifier que la date affichée change et que l'enveloppe cash se recharge.

- [ ] **Step 4 : Commit**

```bash
git add app/\(dashboard\)/saisie/page.tsx
git commit -m "feat: add date picker for fast navigation in caisse daily entry"
```

---

## Task 7 : Corriger le centrage du date picker import CSV

**Fichiers :**
- Modify: `app/(dashboard)/import/page.tsx` (lignes 199-219)

- [ ] **Step 1 : Centrer les labels sur mobile**

Trouver le conteneur des deux date pickers (ligne ~199) :

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
  <div className="flex-1">
    <label className="text-xs text-alaska-muted block mb-1">Du</label>
```

Remplacer par :

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
  <div className="flex-1">
    <label className="text-xs text-alaska-muted block mb-1 text-center sm:text-left">Du</label>
```

Faire de même pour le label "Au" :

```tsx
  <div className="flex-1">
    <label className="text-xs text-alaska-muted block mb-1 text-center sm:text-left">Au</label>
```

- [ ] **Step 2 : Vérifier build**

```bash
npm run build
```

Résultat attendu : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add app/\(dashboard\)/import/page.tsx
git commit -m "fix: center date picker labels on mobile in import CSV page"
```

---

## Task 8 : Vérification finale Sprint 1

- [ ] **Step 1 : Lancer tous les tests**

```bash
npm run test
```

Résultat attendu : tous les tests PASS, y compris le nouveau `buildDashboardData cashMonth split`.

- [ ] **Step 2 : Lint**

```bash
npm run lint
```

Résultat attendu : aucune erreur.

- [ ] **Step 3 : Build de prod**

```bash
npm run build
```

Résultat attendu : build réussi.

- [ ] **Step 4 : Vérification manuelle**

- Aller sur `/saisie`, onglet **Mois** : vérifier les 4 lignes de dépenses
- Aller sur `/saisie`, onglet **Caisse** : vérifier le date picker de navigation
- Aller sur `/import` : vérifier le centrage des labels "Du" / "Au" sur mobile (redimensionner la fenêtre)
