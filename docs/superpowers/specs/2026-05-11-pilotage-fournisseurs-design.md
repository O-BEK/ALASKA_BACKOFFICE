# Spec — Pilotage fournisseurs & métriques restaurant

**Date** : 2026-05-11
**Statut** : Approuvé

## Contexte

Alaska Neo Bistrot saisit ses achats cash quotidiennement mais n'a pas de visibilité sur ses fournisseurs payés par virement (Poulet, Nor Saga, Solidernet). La section bancaire du reporting crée de la confusion sans apporter de valeur tant qu'il n'y a pas d'import PDF bancaire. L'objectif est d'offrir un pilotage complet : saisie mensuelle des virements fournisseurs, métriques de rentabilité aux standards restauration, et comparatif semaine N-1.

## Périmètre

### Ajouts
1. Saisie mensuelle des fournisseurs virement dans l'onglet Mois de `/saisie`
2. Métriques prime cost + résultat net estimé (dans `/saisie` et `/reporting`)
3. Graphique barres 4 semaines vs même 4 semaines N-1 dans `/reporting`

### Suppressions
1. Section "Banque + Cash — résultat réel" dans `/reporting`
2. Tout lien / texte "import PDF / relevés bancaires" dans `/reporting`

---

## Section 1 — Modèle de données

### Fournisseurs mensuels

Réutilisation de la table `expenses` existante. Convention de stockage :

| Champ | Valeur |
|-------|--------|
| `date` | 1er du mois (ex: `2026-05-01`) |
| `category` | `MP` pour Poulet et Nor Saga, `AUTRE` pour Solidernet |
| `label` | Nom exact du fournisseur |

### Migration SQL

Fichier : `supabase/migrations/20260511000000_monthly_supplier_templates.sql`

Actions :
1. Insérer une nouvelle `expense_section` : nom="Fournisseurs mois (virement)", emoji="🏭", expense_category="MP", sort_order=10
2. Insérer les 3 items : Poulet (MP), Nor Saga (MP), Solidernet (AUTRE — section séparée ou item marqué)
3. Désactiver (`is_active = false`) l'item "Poulet" dans la section MP journalière existante pour éviter le double comptage

> Note : Solidernet est de catégorie AUTRE. On crée soit un item dans la même section avec un override de catégorie (non supporté actuellement), soit deux sections : "Fournisseurs MP (virement)" + "Fournisseurs divers (virement)". Option retenue : **deux sections**, une MP (Poulet, Nor Saga), une AUTRE (Solidernet).

### Conséquences analytics

Dès qu'ils sont stockés, ces montants remontent automatiquement dans :
- `cash_mp_divers` (MP)
- `total_expenses` (tous)
- `mp_divers_items` (détail par label, déjà implémenté)

Aucun changement de schéma DB.

---

## Section 2 — UI : onglet Mois de `/saisie`

### Carte "Fournisseurs mois (virement)"

Nouvelle carte éditable insérée avant la carte "Pilotage" :

- 3 lignes avec stepper `+/-` + champ numérique (identique au style journalier)
- Labels : Poulet / Nor Saga / Solidernet
- Bouton "Enregistrer fournisseurs"
- Au chargement : lecture des expenses du 1er du mois pour pré-remplir les montants
- Sauvegarde : PUT vers `/api/daily-entry` avec `date = YYYY-MM-01`

### Carte "Pilotage du mois"

Nouvelle carte en lecture seule après la carte fournisseurs :

**Prime cost**
- Formule : `(MP total mois + Salaires mois) / CA total mois × 100`
- Affichage : barre de progression colorée + pourcentage
  - Vert : < 60 %
  - Orange : 60–65 %
  - Rouge : > 65 %
- Légende : "Norme restauration : < 65 %"

**Résultat net estimé**
- Formule : `CA total − MP total − Salaires − Charges fixes actives du mois`
- Affichage : montant en MAD, couleur verte si positif, rouge si négatif
- Sous-texte : "Charges fixes : X MAD/mois"

### Source des données

Deux nouveaux champs ajoutés au retour de `buildCashMonthSummary` dans `analytics.ts` :

```typescript
prime_cost_pct: number        // (total_mp + total_rh) / ca_total * 100
resultat_net: number          // ca_total - total_mp - total_rh - fixed_charges_total
```

Ajoutés au schéma `cashMonthSchema` dans `contracts.ts` + type `DashboardState` dans `useDashboard.ts`.

---

## Section 3 — Analytics : 4 semaines vs N-1

### Nouvelle fonction `buildLast4WeeksComparison(db: PilotDb)`

Dans `lib/server/analytics.ts` :

- Calcule les 4 dernières semaines ISO (lundi–dimanche) à partir de la date courante
- Pour chaque semaine : somme du CA total des jours dans `daily_sales`
- N-1 : même numéro de semaine ISO, année précédente

```typescript
// Retour
[
  { label: "S18", current: number, previous: number },
  { label: "S17", current: number, previous: number },
  { label: "S16", current: number, previous: number },
  { label: "S15", current: number, previous: number },
]
```

### Exposition API

Ajout du champ `weekComparison` dans le retour de `/api/reporting/route.ts`.

Ajout du schéma Zod `weekComparisonSchema` dans `contracts.ts`.

### Graphique dans `/reporting`

- Bibliothèque : Recharts (`BarChart` + `Bar` groupées)
- 2 barres par semaine : bleu (`#4A7C6F` = alaska-sage) pour l'année courante, gris (`#D1D5DB`) pour N-1
- Légende : "2026" / "2025"
- Titre : "CA semaine — 2026 vs 2025"
- Placement : après le bloc "Jours forts / faibles", avant le tableau comparatif mensuel

---

## Section 4 — Reporting : suppressions

### Blocs supprimés dans `app/(dashboard)/reporting/page.tsx`

1. La carte **"Banque + Cash — résultat réel"** (conditionnel sur `financial.has_data`)
2. Tout texte / lien pointant vers l'import PDF ou les relevés bancaires

### Ce qui reste dans l'API (non supprimé)

Les champs `bankConsolidation` et `financialConsolidation` restent dans `/api/reporting/route.ts` pour ne pas casser d'éventuels usages futurs. Seule l'UI ne les consomme plus.

---

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| `supabase/migrations/20260511000000_monthly_supplier_templates.sql` | Nouveau |
| `lib/server/analytics.ts` | `buildCashMonthSummary` + `buildLast4WeeksComparison` |
| `lib/contracts.ts` | Schémas `cashMonthSchema` + `weekComparisonSchema` |
| `lib/hooks/useDashboard.ts` | Type `cashMonth` étendu |
| `app/(dashboard)/saisie/page.tsx` | Carte fournisseurs + carte pilotage dans onglet Mois |
| `app/(dashboard)/reporting/page.tsx` | Suppression blocs banque + ajout graphique + métriques |
| `app/api/reporting/route.ts` | Ajout `weekComparison` dans le retour |

## Tests

Après implémentation, relancer :
```bash
npm run test
npm run lint
npm run build
```

Les tests `analytics.test.ts` devront couvrir `buildLast4WeeksComparison` et les nouveaux champs de `buildCashMonthSummary`.
