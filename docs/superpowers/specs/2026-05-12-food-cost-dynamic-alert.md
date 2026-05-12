# Spec — Food cost dynamique et alertes

**Date** : 2026-05-12
**Statut** : Approuvé
**Branche** : main

## Contexte

Le seuil de rentabilité utilise un taux de coût variable fixe à 28% (`VARIABLE_COST_RATE` dans `lib/calculations.ts`). Ce taux ne reflète pas la réalité du mois en cours. En avril 2026, le food cost réel est ~26% ; en janvier il était ~19% (données incomplètes). Le seuil affiché (127 500 MAD) est donc approximatif.

Par ailleurs, aucune alerte n'existe quand le food cost dépasse 30% — seuil critique pour la rentabilité d'un restaurant.

## Objectif

1. Rendre le taux variable **dynamique** : utiliser le `food_cost_pct` du mois affiché
2. Appliquer des **règles de plancher et de plafond** pour gérer les mois mal renseignés
3. Afficher une **alerte visuelle** partout où le food cost apparaît

## Règles métier

### Taux effectif pour le seuil de rentabilité

```
food_cost_pct < 20%  → effectiveRate = 30%  (données suspectes, taux conservateur)
food_cost_pct 20-28% → effectiveRate = 28%  (plancher)
food_cost_pct ≥ 28%  → effectiveRate = food_cost_pct réel
```

### Statut food cost

| Condition | Statut | Signification |
|-----------|--------|---------------|
| `food_cost_pct < 20%` | `"suspect"` | Achats probablement non tous saisis |
| `20% ≤ food_cost_pct ≤ 30%` | `"ok"` | Zone normale |
| `food_cost_pct > 30%` | `"alert"` | Food cost hors contrôle |

### Seuil de rentabilité résultant

```
breakeven = charges_fixes_actives / (1 - effectiveVariableCostRate(food_cost_pct))
```

Le seuil est donc dynamique par mois : chaque vue (dashboard, saisie, reporting) utilise le food cost du mois qu'elle affiche.

## Ce qui change

### `lib/calculations.ts`

Ajouter :
```typescript
export const FOOD_COST_SUSPECT_THRESHOLD = 20   // %
export const FOOD_COST_ALERT_THRESHOLD = 30     // %
export const FOOD_COST_FLOOR_RATE = 0.28        // taux plancher

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

`VARIABLE_COST_RATE` (0.28) reste comme valeur de fallback statique quand aucune donnée n'est disponible.

### `lib/server/analytics.ts`

**`buildCashMonthSummary`** (alimente `/saisie`) — déjà calcule `food_cost_pct`. Ajouter :
- `food_cost_status: getFoodCostStatus(food_cost_pct)`
- `effective_variable_rate: effectiveVariableCostRate(food_cost_pct)`
- Recalculer `breakeven` avec le taux effectif (actuellement non retourné par cette fonction — l'ajouter)

**`buildMonthlyKPIs`** (alimente dashboard + reporting) — calculer `food_cost_pct` depuis les dépenses du mois, puis :
- `food_cost_status`
- `effective_variable_rate`
- `breakeven` recalculé avec `effectiveVariableCostRate(food_cost_pct)` au lieu de `liveBreakeven(db)` fixe

**`liveBreakeven`** — ajouter un paramètre optionnel `variableCostRate`:
```typescript
function liveBreakeven(db: PilotDb, variableCostRate = VARIABLE_COST_RATE): number
```

### `lib/contracts.ts`

Ajouter dans `cashMonthSchema` :
```typescript
food_cost_status: z.enum(["suspect", "ok", "alert"]).catch("ok")
effective_variable_rate: z.coerce.number().catch(0.28)
```

Mettre à jour `parseDashboardState` et les interfaces TypeScript.

### `lib/hooks/useDashboard.ts`

Ajouter `food_cost_status` et `effective_variable_rate` dans l'interface `CashMonth` et dans `emptyCashMonth()`.

### Composant partagé `components/ui/FoodCostAlert.tsx`

```tsx
// Props: status: FoodCostStatus, pct: number, effectiveRate: number
// Rendu :
// suspect → badge gris + "⚠️ Achats incomplets — seuil estimé à 30%"
// ok      → valeur en vert, pas de badge
// alert   → badge rouge + "🚨 Food cost hors contrôle — vérifier les achats"
```

### Pages UI

| Page | Emplacement | Action |
|------|-------------|--------|
| `app/(dashboard)/saisie/page.tsx` | Section "Pilotage du mois" — à côté de `food_cost_pct` | Remplacer la coloration actuelle par `FoodCostAlert` |
| `app/(dashboard)/page.tsx` | KPI food cost | Ajouter `FoodCostAlert` |
| `app/(dashboard)/reporting/page.tsx` | Ligne food cost du mois | Ajouter `FoodCostAlert` |

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| `lib/calculations.ts` | Ajouter constantes + fonctions |
| `lib/server/analytics.ts` | Taux dynamique dans breakeven, exposer `food_cost_status` + `effective_variable_rate` |
| `lib/contracts.ts` | Ajouter champs schema |
| `lib/hooks/useDashboard.ts` | Ajouter champs interface |
| `components/ui/FoodCostAlert.tsx` | Créer composant |
| `app/(dashboard)/saisie/page.tsx` | Utiliser `FoodCostAlert` |
| `app/(dashboard)/page.tsx` | Utiliser `FoodCostAlert` |
| `app/(dashboard)/reporting/page.tsx` | Utiliser `FoodCostAlert` |
| `tests/calculations.test.ts` | Tester `getFoodCostStatus` + `effectiveVariableCostRate` |
| `tests/analytics.test.ts` | Tester breakeven dynamique |

## Tests attendus

- `getFoodCostStatus(15)` → `"suspect"`
- `getFoodCostStatus(25)` → `"ok"`
- `getFoodCostStatus(32)` → `"alert"`
- `effectiveVariableCostRate(15)` → `0.30`
- `effectiveVariableCostRate(24)` → `0.28`
- `effectiveVariableCostRate(31)` → `0.31`
- Breakeven avec food_cost 26% → `charges / (1 - 0.28)` (plancher appliqué)
- Breakeven avec food_cost 32% → `charges / (1 - 0.32)`
- `npm run test` → tous les tests passent
- `npm run lint` → 0 erreur
- `npx tsc --noEmit` → 0 erreur
