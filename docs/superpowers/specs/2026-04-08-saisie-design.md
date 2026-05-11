# Design — Module Saisie (refonte)

**Date :** 2026-04-08  
**Statut :** Approuvé

---

## Contexte

Refonte basée sur `Alaska_Suivi_Semaines_2026.xlsx`. Le projet est dans `claude/` — architecture localStorage, pas de Supabase.

---

## Ce qui change vs l'existant

| Élément | Avant | Après |
|---|---|---|
| Récap bas de formulaire | Marge nette estimée | **Solde caisse** (CA - total sorties) |
| Onglet Semaine desktop | Liste lecture seule | **Grille éditable** (days en colonnes) |
| Postes MP | 7 postes dont "Autre MP" séparé | 5 postes alignés Excel |
| Personnel | Ramzi, Leila... (pas Othman) | + Othman (Boss) |

---

## Postes MP (alignés Excel)

```
Poissonnier | Boucher | Poulet | Eau | Technicien
```

## Solde caisse

```
Solde caisse = CA caisse - Σ toutes dépenses du jour
```
Affiché en bas de formulaire à la place de "Marge nette estimée". Vert si positif, rouge si négatif.

---

## Vue Semaine desktop — grille éditable

```
Poste              | Lun   | Mar   | Mer   | Jeu   | Ven   | Sam   | Dim
───────────────────┼───────┼───────┼───────┼───────┼───────┼───────┼──────
💰 CA Caisse       | 4 965 | 2 590 | 1 721 | 3 840 | 1 884 | 4 271 |  —
🥩 MP
  Poissonnier      |   —   |  392  |   —   |   —   |   —   |   —   |   —
  Boucher          |  345  |  783  |   —   |  621  |   —   |   —   |  442
  ...
👥 Personnel
  Ramzi            |   —   |  500  |   —   |   —   |   —   |   —   |   —
  ...
📦 Autre      [+]  |       |       |       |       |       |       |
───────────────────┼───────┼───────┼───────┼───────┼───────┼───────┼──────
Total sorties      | 2 947 | 3 375 |   —   |  621  |   —   | 1 000 | 2 348
💵 Solde caisse    | 2 018 |  -785 | 1 721 | 3 219 | 1 884 | 3 271 |  -464
```

- Clic sur cellule → input inline
- Blur/Enter → save via `saveLocalEntry`
- Jours futurs grisés
- Résumé semaine en bas

---

## Fichiers impactés

- `lib/mock-data.ts` — ajouter Othman au FIXED_CHARGES
- `app/(dashboard)/saisie/page.tsx` — fix postes, solde caisse, grille desktop
- `lib/hooks/useWeekEntries.ts` — nouveau hook mutable pour la grille
- `components/saisie/WeekGrid.tsx` — nouveau composant grille éditable
