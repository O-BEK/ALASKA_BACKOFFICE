# Spec — Correction double-comptage RH dans prime cost & résultat net

**Date** : 2026-05-11
**Statut** : Approuvé

## Contexte

Certains employés ont un salaire **total** enregistré dans `/charges` (`fixed_charges.amount`). Une partie de ce salaire est versée par virement bancaire, le reste est versé en cash et saisi dans `/saisie` comme dépense catégorie `RH`.

Conséquence actuelle :
```
resultat_net = CA − cash_mp − cash_rh − fixed_charges_total
```
La part cash (`cash_rh`) est soustraite deux fois :
1. via `cash_rh` (dépense saisie dans `/saisie`)
2. via `fixed_charges_total` (la charge fixe contient le salaire total, part cash incluse)

Le prime cost est également sous-estimé : il n'utilise que `cash_rh` et ignore les salaires payés entièrement par virement.

## Périmètre

### Ce qui change
- Calcul `prime_cost_pct` dans `buildCashMonthSummary` → utilise `total_rh` (salaires réels complets)
- Calcul `resultat_net` dans `buildCashMonthSummary` → ne soustrait plus `cash_rh` en double

### Ce qui ne change pas
- `cash_rh` reste intact (flux de trésorerie caisse)
- `cash_purchases` reste intact (enveloppe caisse)
- Aucune migration SQL
- Aucun changement d'UI (les métriques affichées seront simplement correctes)

---

## Section 1 — Logique corrigée

### Principe

La correspondance se fait par nom : `expenses.label === fixed_charges.name`.
C'est fiable parce que `/saisie` stocke exactement `staffMember.name` comme label (vérifié dans le code — `handleExpenseChange(staffMember.name, "RH", value)`).

### Nouveaux calculs dans `buildCashMonthSummary`

```typescript
// Charges personnel actives ce mois
const activeStaffCharges = db.fixed_charges
  .filter((c) => isChargeActiveForMonth(c, month) && c.is_staff)

// Ensemble des noms d'employés déjà couverts par fixed_charges
const staffNamesInCharges = new Set(activeStaffCharges.map((c) => c.name))

// RH couvert par fixed_charges (salaire total — part virement + cash confondus)
const rh_in_fixed = activeStaffCharges.reduce((sum, c) => sum + c.amount, 0)

// RH cash non couvert par fixed_charges (intérimaires, paiements ponctuels sans fiche /charges)
const rh_not_in_fixed = expenses
  .filter((e) => e.category === "RH" && !staffNamesInCharges.has(e.label))
  .reduce((sum, e) => sum + e.amount, 0)

// Coût RH total réel pour les métriques de rentabilité
const total_rh = rh_in_fixed + rh_not_in_fixed
```

### Formules mises à jour

```typescript
// Avant : (cash_mp_divers + cash_rh) / ca_global * 100
// Après :
const prime_cost_pct = ca_global > 0
  ? (cash_mp_divers + total_rh) / ca_global * 100
  : 0

// Avant : ca_global - cash_mp_divers - cash_rh - fixed_charges_total
// Après :
const resultat_net = ca_global - cash_mp_divers - rh_not_in_fixed - fixed_charges_total
```

**Équivalence mathématique** (vérification) :
```
resultat_net
= ca − mp − rh_not_in_fixed − fixed_charges_total
= ca − mp − rh_not_in_fixed − (rh_in_fixed + non_staff_fixed)
= ca − mp − (rh_in_fixed + rh_not_in_fixed) − non_staff_fixed
= ca − mp − total_rh − non_staff_fixed  ✓
```
Le salaire total est déduit exactement une fois, via `fixed_charges_total`.

### Comportement par cas

| Cas | Avant | Après |
|-----|-------|-------|
| Employé 5 000 MAD — 3 000 virement + 2 000 cash | −7 000 MAD (double comptage) | −5 000 MAD ✓ |
| Employé 4 000 MAD — 100% virement, 0 cash saisi | −4 000 MAD ✓ | −4 000 MAD ✓ |
| Employé 3 000 MAD — 100% cash saisi | −6 000 MAD (double comptage) | −3 000 MAD ✓ |
| Intérimaire 800 MAD cash — pas de fiche /charges | −800 MAD ✓ | −800 MAD ✓ |

---

## Section 2 — Fichiers impactés

| Fichier | Action |
|---------|--------|
| `lib/server/analytics.ts` | Modifier `buildCashMonthSummary` : ajouter `activeStaffCharges`, `staffNamesInCharges`, `rh_in_fixed`, `rh_not_in_fixed`, `total_rh` ; corriger `prime_cost_pct` et `resultat_net` |
| `tests/analytics.test.ts` | Ajouter 3 tests dans un nouveau describe `"buildCashMonthSummary — RH sans double comptage"` |

---

## Section 3 — Tests

### Nouveaux tests dans `tests/analytics.test.ts`

**Test 1 : Employé mixte (virement + cash) — aucun double comptage**
```
fixed_charges: [{ name: "Ahmed", amount: 5000, is_staff: true, is_active: true }]
expenses: [{ label: "Ahmed", category: "RH", amount: 2000 }]  // part cash
→ resultat_net = ca − mp − 0(rh_not_in_fixed) − 5000 = ca − mp − 5000 ✓
→ prime_cost_pct = (mp + 5000) / ca × 100 ✓
```

**Test 2 : Intérimaire sans fiche /charges**
```
fixed_charges: []
expenses: [{ label: "Intérimaire", category: "RH", amount: 800 }]
→ rh_not_in_fixed = 800
→ resultat_net = ca − mp − 800 − 0(fixed_charges) ✓
→ prime_cost_pct = (mp + 800) / ca × 100 ✓
```

**Test 3 : Employé 100% virement — pas de cash saisi**
```
fixed_charges: [{ name: "Sara", amount: 4000, is_staff: true, is_active: true }]
expenses: []  // aucun paiement cash
→ rh_not_in_fixed = 0
→ resultat_net = ca − mp − 0 − 4000 ✓
→ prime_cost_pct = (mp + 4000) / ca × 100 ✓
```

---

## Tests à relancer après implémentation

```bash
npm run test
npm run lint
npm run build
```
