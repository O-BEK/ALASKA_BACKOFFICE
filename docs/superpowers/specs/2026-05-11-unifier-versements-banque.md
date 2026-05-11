# Spec — Unifier les versements banque et corriger la card Mois

**Date** : 2026-05-11
**Statut** : Approuvé
**Branche** : main

## Contexte

L'utilisateur a ajouté un item template "Cash" dans une section MP de `/charges`. Il l'utilise pour enregistrer ses versements de caisse vers la banque. Résultat : ces montants sont traités comme des achats alimentaires (catégorie MP), gonflant le `food_cost_pct` (~39% au lieu de ~27% en avril) et le `Total achats MP cash`.

Par ailleurs, des entrées "Virement banque" (catégorie CHARGES) existent en parallèle — `cash_depot` — mais leur provenance n'est pas claire pour l'utilisateur et elles s'affichent en orange comme des charges.

Les deux mécanismes représentent la même chose : de l'argent sorti du tiroir-caisse et déposé sur le compte bancaire de la société. Ce n'est pas une charge P&L — c'est un transfert de trésorerie neutre.

## Ce qui change

### 1. Migration SQL

Recatégoriser toutes les dépenses mal classées :

```sql
UPDATE expenses
SET category = 'CHARGES', label = 'Virement banque'
WHERE label = 'Cash' AND category IN ('MP', 'AUTRE');
```

Désactiver l'item template "Cash" dans les sections MP/AUTRE :

```sql
UPDATE expense_item_templates
SET is_active = false
WHERE label = 'Cash';
```

S'assurer qu'il existe un item "Virement banque" dans une section CHARGES des templates (pour que l'utilisateur puisse continuer à saisir ses dépôts banque) :

```sql
-- Insérer seulement si absent
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

### 2. Redesign de la card Mois dans `/saisie`

**Avant** : tout en orange, `cash_depot` mélangé avec les charges, pas de sous-totaux.

**Après** : deux sections distinctes dans la card.

```
Cash POS mensuel          72 578 MAD
Mouvements POS            -7 983 MAD

── Dépenses cash ──────────────────────
[items MP cash journaliers]
Total achats MP cash      18 845 MAD   (vert atténué)
Salaires cash             17 442 MAD   (orange)
Autres charges cash            X MAD   (orange)
Total dépenses            36 287 MAD   ← sous-total, fond gris clair

── Versé en banque ────────────────────
Virements banque          27 234 MAD   ← gris neutre, pas orange

── ────────────────────────────────────
Cash théorique enveloppe      74 MAD
CA global indicatif      152 572 MAD
```

**Règles d'affichage :**
- "Versé en banque" = `cash_depot` — couleur `text-alaska-muted`, pas orange
- "Total dépenses" = `cash_mp_divers - virement_mp_divers + cash_rh + cash_charges` (hors depot)
- N'afficher "Versé en banque" que si `cash_depot > 0`
- N'afficher "Total dépenses" que si au moins une dépense existe

### 3. Aucun changement analytics

`cash_depot` est déjà :
- Exclu de `cash_charges` (filtre `label !== VIREMENT_BANQUE_LABEL`)
- Exclu de `resultat_net`
- Exclu de `food_cost_pct` et `prime_cost_pct`
- Inclus dans `cash_envelope` (correct — le cash a physiquement quitté le tiroir)

Une fois les données migrées, les métriques sont automatiquement correctes.

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| `supabase/migrations/20260511100000_unify_bank_deposits.sql` | Nouveau |
| `app/(dashboard)/saisie/page.tsx` | Restructurer la card Mois |
| `tests/analytics.test.ts` | Ajouter test : dépôt banque exclu des charges |

## Tests attendus après implémentation

- `npm run test` → 62+/62 tests passent
- `npm run lint` → 0 erreur
- `npx tsc --noEmit` → 0 erreur
- Vérification manuelle avril : food_cost_pct ~27%, "Versé en banque" en gris, enveloppe inchangée
