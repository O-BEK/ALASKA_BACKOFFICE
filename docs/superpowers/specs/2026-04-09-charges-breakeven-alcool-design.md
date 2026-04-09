# Design : Charges dynamiques, Breakeven temps réel & Licence alcool

**Date** : 2026-04-09
**Statut** : Approuvé

---

## Contexte

Trois problèmes liés à la gestion des charges fixes et aux objectifs :

1. Le seuil de rentabilité est hardcodé (`BREAKEVEN = 136 667`) dans `lib/calculations.ts` et utilisé dans `lib/server/analytics.ts`. Quand l'utilisateur met à jour ses charges dans `/charges`, le dashboard/semaine/reporting ne reflète pas le nouveau seuil.

2. La page `/charges` ne permet pas d'ajouter de nouvelles charges ou de nouveaux salariés — seulement éditer les montants existants et désactiver le personnel.

3. La licence d'alcool est un tournant stratégique pour Alaska Neo Bistrot. Elle n'est pas encore dans le plan d'action et il n'existe aucun mécanisme pour répercuter son impact sur les objectifs futurs quand elle sera obtenue.

**Données de référence** : analyse de 14 046 tickets (oct 2024 → avr 2026)
- Ticket moyen actuel : **170 MAD**
- Ticket moyen cible avec alcool : **250 MAD** (soit +47%)

---

## Feature 1 — Breakeven dynamique

### Problème

`lib/server/analytics.ts` utilise la constante `BREAKEVEN` importée de `lib/calculations.ts` dans `buildMonthlyKpis`, `buildDashboardData`, et `buildWeekData`. La constante ne reflète pas les charges réelles en base.

### Solution

`PilotDb` (chargé par `readSnapshot` dans `supabase-store.ts`) contient déjà `db.fixed_charges`. Il suffit de calculer le seuil à la volée dans `analytics.ts` :

```ts
function calcLiveBreakeven(db: PilotDb): number {
  const total = db.fixed_charges
    .filter(c => c.is_active)
    .reduce((sum, c) => sum + c.amount, 0)
  return calcBreakeven(total)
}
```

Partout où `BREAKEVEN` est utilisé dans `analytics.ts`, on substitue `calcLiveBreakeven(db)`. La constante dans `calculations.ts` reste comme fallback (utilisée uniquement si `fixed_charges` est vide).

### Fichiers impactés

- `lib/server/analytics.ts` — remplacer `BREAKEVEN` par `calcLiveBreakeven(db)`
- `lib/calculations.ts` — garder la constante mais ne plus l'exporter comme valeur de référence principale

---

## Feature 2 — Ajout de charges dans l'UI

### Comportement

Chaque catégorie dans `/charges` affiche un bouton **"+ Ajouter"** en bas de sa card. Le clic ouvre un formulaire inline (pas de modal) avec :

**Pour PERSONNEL** :
- Nom (texte)
- Salaire mensuel (nombre, MAD)
- Jour de paiement (nombre 1–31, optionnel)

**Pour toutes les autres catégories** :
- Libellé (texte)
- Montant mensuel (nombre, MAD)
- Type : `fixe` | `variable` | `semi-fixe`
- Jour de paiement (nombre 1–31, optionnel)

Un bouton **"+ Nouvelle catégorie"** en bas de page permet de créer une charge dans une catégorie non listée (saisie libre du nom de catégorie).

### API

Nouveau endpoint `POST /api/charges` :

```ts
// Body
{ name: string, category: string, amount: number, type: string, payment_day?: number, is_staff?: boolean }
// Response
{ charges: FixedCharge[] }
```

Réservé aux `admin`. Insère dans `fixed_charges` avec `start_date = today`, `is_active = true`.

### Fichiers impactés

- `app/api/charges/route.ts` — ajouter handler `POST`
- `lib/server/supabase-store.ts` — ajouter `createFixedCharge()`
- `lib/hooks/useCharges.ts` — ajouter `createCharge()`
- `app/(dashboard)/charges/page.tsx` — ajouter UI formulaire inline par catégorie

---

## Feature 3 — Licence alcool : action item + impact objectifs

### 3a. Action item

Insérer immédiatement en base (via migration SQL ou seed) :

```sql
INSERT INTO action_items (lever, title, description, priority, deadline, impact, status, sort_order)
VALUES (
  'pilotage',
  'Obtenir la licence d''alcool',
  'Démarches administratives auprès de la Wilaya de Rabat pour obtenir l''autorisation de vente d''alcool. Tournant majeur : ticket moyen estimé à 250 MAD (+47%).',
  'urgent',
  'T3 2026',
  'Ticket moyen 170 → 250 MAD (+47%) · CA annuel projeté +40%',
  'todo',
  0
);
```

Elle apparaît en tête du plan d'action grâce à `sort_order = 0`.

### 3b. Validation de la licence

Quand l'action "Obtenir la licence d'alcool" est marquée comme `done` dans `/objectifs`, un dialogue de confirmation s'affiche avec :

- **Date d'effet** : mois d'entrée en vigueur (par défaut mois suivant)
- **Uplift proposé** : +47% (calculé depuis ticket moyen 170→250 MAD, modifiable)
- **Prévisualisation** : liste des mois à venir avec ancien et nouveau `target_ca`

À la confirmation :
1. `action_items.status` → `done`, `completed_at` → maintenant
2. `monthly_objectives` — pour chaque mois >= date d'effet : `target_ca = ROUND(target_ca * (1 + uplift / 100))`
3. `objectives` — le scénario `realistic` de l'année en cours est recalculé comme somme des `monthly_objectives` mis à jour

### 3c. Persistance de l'uplift

Une nouvelle colonne `metadata JSONB` sur `action_items` stocke `{ "alcool_uplift_pct": 47, "alcool_effect_month": "2026-09" }` pour traçabilité. Si la colonne n'existe pas encore, la migration l'ajoute.

### Fichiers impactés

- Migration SQL : colonne `metadata JSONB` sur `action_items`
- `app/api/objectives/route.ts` — ajouter endpoint `POST /api/objectives/alcool-validate`
- `lib/server/supabase-store.ts` — ajouter `applyAlcoolLicenseUplift()`
- `app/(dashboard)/objectifs/page.tsx` — dialogue de validation sur l'action "licence alcool"

---

## Ordre d'implémentation recommandé

1. Fix breakeven dynamique (petit, fort impact, sans risque)
2. POST /api/charges + useCharges.createCharge (backend)
3. UI ajout de charge (frontend)
4. Seed action item licence alcool en base
5. Dialogue de validation + uplift monthly_objectives

---

## Non-inclus dans ce scope

- Gestion d'une catégorie "alcool" dans les dépenses ou les ventes
- Reporting séparé alcool vs soft
- Désactivation de l'uplift / retour arrière
