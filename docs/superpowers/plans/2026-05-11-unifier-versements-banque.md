# Unifier les versements banque — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Éliminer les dépôts bancaires cash des catégories de charges (MP/AUTRE) et les afficher visuellement comme transferts neutres dans la card Mois de `/saisie`.

**Architecture:** Migration SQL corrige les données existantes et désactive le template "Cash" mal catégorisé. Un nouveau test TDD vérifie l'exclusion. La card Mois est redessinée avec deux sections (Dépenses cash + Versé en banque) sans changer la couche analytics.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase/PostgreSQL, Tailwind CSS, Vitest

---

## File Map

| Fichier | Action |
|---------|--------|
| `supabase/migrations/20260511100000_unify_bank_deposits.sql` | Créer |
| `tests/analytics.test.ts` | Modifier — ajouter 1 test d'exclusion dépôt banque |
| `app/(dashboard)/saisie/page.tsx` | Modifier — restructurer card Mois (lignes 390–438) |

---

### Task 1: Migration SQL — recatégoriser et nettoyer les templates

**Files:**
- Create: `supabase/migrations/20260511100000_unify_bank_deposits.sql`

- [ ] **Step 1: Créer le fichier de migration**

```sql
-- supabase/migrations/20260511100000_unify_bank_deposits.sql

-- 1. Recatégoriser toutes les dépenses "Cash" mal classées en MP ou AUTRE
UPDATE expenses
SET category = 'CHARGES', label = 'Virement banque'
WHERE label = 'Cash' AND category IN ('MP', 'AUTRE');

-- 2. Désactiver le template "Cash" dans toutes les sections
UPDATE expense_item_templates
SET is_active = false
WHERE label = 'Cash';

-- 3. S'assurer qu'il existe un template "Virement banque" dans une section CHARGES
INSERT INTO expense_item_templates (id, section_id, label, sort_order, is_active)
SELECT gen_random_uuid(), s.id, 'Virement banque', 99, true
FROM expense_sections s
WHERE s.expense_category = 'CHARGES'
  AND NOT EXISTS (
    SELECT 1 FROM expense_item_templates t
    WHERE t.section_id = s.id AND t.label = 'Virement banque'
  )
LIMIT 1;
```

- [ ] **Step 2: Appliquer la migration via MCP Supabase**

Appeler `mcp__supabase__apply_migration` avec le contenu ci-dessus.

Expected: migration appliquée sans erreur.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260511100000_unify_bank_deposits.sql
git commit -m "feat: migrate Cash MP expenses to Virement banque CHARGES and disable Cash template"
```

---

### Task 2: Test TDD — dépôt banque exclu des charges analytiques

**Files:**
- Modify: `tests/analytics.test.ts` — ajouter dans le describe block `buildDashboardData cashMonth split` (après la ligne ~304)

- [ ] **Step 1: Écrire le test qui va échouer (vérifier qu'il passe déjà)**

Après la ligne 304 (fin du describe block existant), ajouter un nouveau describe:

```typescript
describe("buildDashboardData — dépôt banque exclu des charges", () => {
  it("cash_depot n'est pas inclus dans cash_charges ni food_cost_pct", () => {
    const db = makeDb({
      daily_sales: [makeSale({ id: "s1", date: "2026-04-15", ca_caisse: 100000, ca_b2b: 52000 })],
      expenses: [
        { id: "e1", date: "2026-04-15", category: "MP",      label: "Poissonnier",    amount: 18000, notes: "", created_by: null, updated_at: "" },
        { id: "e2", date: "2026-04-15", category: "RH",      label: "Ramzi",           amount: 17000, notes: "", created_by: null, updated_at: "" },
        { id: "e3", date: "2026-04-15", category: "CHARGES", label: "Virement banque", amount: 27000, notes: "", created_by: null, updated_at: "" },
      ],
    })
    const result = buildDashboardData(db, "2026-04")
    // Le dépôt banque est bien séparé dans cash_depot
    expect(result.cashMonth.cash_depot).toBe(27000)
    // cash_charges n'inclut PAS le dépôt banque (catégorie CHARGES hors "Virement banque")
    expect(result.cashMonth.cash_charges).toBe(0)
    // food_cost_pct n'est pas affecté par le dépôt banque
    // 18000 MP / 152000 ca_global ≈ 11.84%
    expect(result.cashMonth.food_cost_pct).toBeCloseTo(11.84, 1)
    // resultat_net n'inclut pas le dépôt banque
    // cash_envelope = 100000 - 18000 - 17000 - 27000 = 38000
    expect(result.cashMonth.cash_envelope).toBe(38000)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il passe**

```bash
npx vitest run tests/analytics.test.ts --reporter=verbose
```

Expected: le nouveau test passe (les règles analytics sont déjà correctes, le test sert de garde-fou).

Si le test échoue, vérifier les assertions avec les vraies valeurs retournées et ajuster les chiffres sans modifier la logique analytics.

- [ ] **Step 3: Commit**

```bash
git add tests/analytics.test.ts
git commit -m "test: verify bank deposit excluded from cash_charges and food_cost_pct"
```

---

### Task 3: Redesign card Mois dans `/saisie`

**Files:**
- Modify: `app/(dashboard)/saisie/page.tsx` lignes 390–438

- [ ] **Step 1: Lire le bloc actuel pour vérifier les variables disponibles**

Le bloc actuel (lignes 390–438) utilise :
- `cashMonth.cash_sales`, `cashMonth.cash_movements`
- `cashMonth.mp_divers_items`, `cashMonth.cash_mp_divers`, `cashMonth.virement_mp_divers`
- `cashMonth.cash_rh`, `cashMonth.cash_charges`, `cashMonth.cash_depot`
- `cashMonth.cash_envelope`, `cashMonth.ca_global`, `cashMonth.anomaly_days`

Toutes ces variables existent déjà — aucun changement analytics nécessaire.

- [ ] **Step 2: Calculer le sous-total dépenses localement**

Le sous-total "Total dépenses" = `cash_mp_divers - virement_mp_divers + cash_rh + cash_charges`.

Dans le composant, juste avant le JSX de la card (autour de la ligne 390), ajouter:

```typescript
const totalDepensesCash = cashMonth.cash_mp_divers - cashMonth.virement_mp_divers + cashMonth.cash_rh + cashMonth.cash_charges
const hasCashDepenses = totalDepensesCash > 0
const hasCashDepot = cashMonth.cash_depot > 0
```

- [ ] **Step 3: Remplacer le bloc card Mois (lignes 390–438)**

Remplacer le contenu de `<CardContent className="pt-4 pb-4 space-y-3">` par:

```tsx
<Card className="bg-white border border-alaska-sage-lt rounded-xl">
  <CardContent className="pt-4 pb-4 space-y-3">
    <div className="flex justify-between">
      <span className="text-sm text-alaska-muted">Cash POS mensuel</span>
      <span className="font-playfair font-bold text-alaska-dark">{formatMAD(cashMonth.cash_sales)}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-sm text-alaska-muted">Mouvements POS</span>
      <span className="font-playfair font-bold text-alaska-dark">{formatMAD(cashMonth.cash_movements)}</span>
    </div>

    {hasCashDepenses && (
      <>
        <div className="border-t border-alaska-sage-lt pt-2">
          <p className="text-xs font-semibold text-alaska-muted uppercase tracking-wide mb-2">Dépenses cash</p>
        </div>
        {cashMonth.mp_divers_items.length > 0 ? (
          <>
            {cashMonth.mp_divers_items.map((item) => (
              <div key={item.label} className="flex justify-between pl-2">
                <span className="text-sm text-alaska-muted">{item.label}</span>
                <span className="font-playfair font-bold text-orange-600">{formatMAD(item.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span className="text-sm text-alaska-dark font-medium">Total achats MP cash</span>
              <span className="font-playfair font-bold text-green-700">{formatMAD(cashMonth.cash_mp_divers - cashMonth.virement_mp_divers)}</span>
            </div>
          </>
        ) : (
          cashMonth.cash_mp_divers - cashMonth.virement_mp_divers > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-alaska-muted">Achats MP & divers cash</span>
              <span className="font-playfair font-bold text-green-700">{formatMAD(cashMonth.cash_mp_divers - cashMonth.virement_mp_divers)}</span>
            </div>
          )
        )}
        {cashMonth.cash_rh > 0 && (
          <div className="flex justify-between">
            <span className="text-sm text-alaska-muted">Salaires cash</span>
            <span className="font-playfair font-bold text-orange-600">{formatMAD(cashMonth.cash_rh)}</span>
          </div>
        )}
        {cashMonth.cash_charges > 0 && (
          <div className="flex justify-between">
            <span className="text-sm text-alaska-muted">Autres charges cash</span>
            <span className="font-playfair font-bold text-orange-600">{formatMAD(cashMonth.cash_charges)}</span>
          </div>
        )}
        <div className="flex justify-between bg-gray-50 rounded px-2 py-1">
          <span className="text-sm text-alaska-dark font-semibold">Total dépenses</span>
          <span className="font-playfair font-bold text-alaska-dark">{formatMAD(totalDepensesCash)}</span>
        </div>
      </>
    )}

    {hasCashDepot && (
      <>
        <div className="border-t border-alaska-sage-lt pt-2">
          <p className="text-xs font-semibold text-alaska-muted uppercase tracking-wide mb-2">Versé en banque</p>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-alaska-muted">Virements banque</span>
          <span className="font-playfair font-bold text-alaska-muted">{formatMAD(cashMonth.cash_depot)}</span>
        </div>
      </>
    )}

    <div className="border-t border-alaska-sage-lt pt-2">
      <div className="flex justify-between">
        <span className="text-sm text-alaska-muted">Cash théorique enveloppe</span>
        <span className="font-playfair font-bold text-alaska-dark">{formatMAD(cashMonth.cash_envelope)}</span>
      </div>
    </div>
    <div className="flex justify-between">
      <span className="text-sm text-alaska-muted">CA global indicatif</span>
      <span className="font-playfair font-bold text-alaska-dark">{formatMAD(cashMonth.ca_global)}</span>
    </div>
    <p className="text-xs text-alaska-muted text-center pt-2">
      {cashMonth.anomaly_days > 0 ? `${cashMonth.anomaly_days} journée(s) en alerte contrôle sur le mois` : "Vue mensuelle cash consolidée"}
    </p>
  </CardContent>
</Card>
```

- [ ] **Step 4: Lancer les vérifications**

```bash
npx tsc --noEmit
npm run lint
npm run test
```

Expected: 0 erreur TypeScript, 0 erreur lint, 62+ tests passent.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/saisie/page.tsx
git commit -m "feat: redesign Mois card — separate Dépenses cash subtotal from Versé en banque"
```

---

### Task 4: Vérification finale

**Files:**
- Aucun fichier à modifier

- [ ] **Step 1: Lancer la suite complète**

```bash
npm run test && npm run lint && npx tsc --noEmit
```

Expected:
- `npm run test` → 63+/63 tests passent (1 nouveau test ajouté)
- `npm run lint` → 0 erreur
- `npx tsc --noEmit` → 0 erreur

- [ ] **Step 2: Vérification manuelle (si serveur dev disponible)**

Ouvrir `/saisie` → vue Mois (avril 2026).

Checklist visuelle:
- "Versé en banque" s'affiche en gris (`text-alaska-muted`), pas en orange
- "Total dépenses" s'affiche sur fond gris clair avec sous-total
- `food_cost_pct` dans "Pilotage du mois" affiche ~27% (pas ~39%)
- "Cash théorique enveloppe" reste inchangé

- [ ] **Step 3: Commit final si pas déjà committé**

```bash
git log --oneline -5
```

Vérifier que les 3 commits des tâches précédentes sont bien présents.
