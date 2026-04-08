# Spec 02 — Dashboard Principal

> Accessible uniquement au rôle `admin`. Le manager est redirigé vers `/saisie`.

---

## 1. Vue d'ensemble

Le dashboard est la page d'accueil de l'admin. Il donne une vision complète et immédiate de la santé financière du restaurant : CA, dépenses, marge, progression vers les objectifs, et les actions prioritaires.

**URL :** `/`
**Rôle requis :** `admin`

---

## 2. Structure de la page

```
┌─────────────────────────────────┐
│  HEADER : "Bonjour Othman 👋"   │
│  Date + indicateur du jour      │
├─────────────────────────────────┤
│  KPI CARDS (2x2 ou 4 en ligne)  │
│  CA Mois | Dép. Mois | Marge   │
│  CA Jour  | vs Obj. mensuel     │
├─────────────────────────────────┤
│  JAUGE SEUIL DE RENTABILITÉ     │
├─────────────────────────────────┤
│  GRAPHIQUE : CA semaine/semaine │
│  (barres, mois courant)         │
├─────────────────────────────────┤
│  GRAPHIQUE : 12 derniers mois   │
│  (ligne CA + ligne seuil)       │
├─────────────────────────────────┤
│  PLAN D'ACTION — Top 3 actions  │
│  prioritaires du moment         │
├─────────────────────────────────┤
│  ACCÈS RAPIDE : Import CSV      │
│  Saisie dépenses | Reporting    │
└─────────────────────────────────┘
```

---

## 3. Section KPI Cards

### 3.1 Cartes principales (mois en cours)

| Carte | Valeur | Comparaison | Couleur |
|---|---|---|---|
| CA Caisse (mois) | X MAD | vs mois précédent (↑↓%) | Bleu |
| Dépenses (mois) | X MAD | vs mois précédent | Orange |
| Marge nette (mois) | X MAD | % du CA | Vert si >0, Rouge si <0 |
| CA/Jour moyen | X MAD | vs objectif journalier | Bleu moyen |

### 3.2 Carte "Aujourd'hui"
- CA saisi pour aujourd'hui (si déjà renseigné)
- Dépenses saisies aujourd'hui
- Lien rapide "Saisir le CA →"
- Si pas encore saisi : badge orange "Non renseigné"

### 3.3 Calcul marge nette estimée
```
Marge = CA Caisse - Dépenses saisies - (CA Caisse × 0.28)
```
> Note : 28% = estimation charges variables (MP non saisies manuellement)
> Ajustable dans les paramètres charges

---

## 4. Jauge Seuil de Rentabilité

Composant visuel horizontal :

```
Seuil : 136 667 MAD/mois
[████████████░░░░░░░░░] 72%
CA actuel : 98 400 MAD — Manque : 38 267 MAD
```

**Couleurs :**
- < 70% → Rouge — "En dessous du seuil"
- 70–99% → Orange — "Proche du seuil"
- ≥ 100% → Vert — "Seuil atteint ✅"

**Données :** CA caisse du mois courant (agrégé depuis `daily_sales`)

---

## 5. Graphique CA par semaine (mois courant)

- **Type :** barres verticales
- **X axis :** Semaines du mois (S1, S2, S3, S4, S5)
- **Y axis :** CA en MAD
- **Données :** agrégation des `daily_sales` par semaine ISO
- **Ligne de référence :** seuil hebdomadaire (= 136 667 / 4.33 ≈ 31 566 MAD)
- **Tooltip :** affiche le CA exact + nb jours + CA moyen/jour
- **Couleur des barres :** vert si au-dessus du seuil hebdo, orange sinon

---

## 6. Graphique 12 derniers mois

- **Type :** courbe (line chart)
- **X axis :** 12 derniers mois (ex: Avr 2025 → Mars 2026)
- **Y axis :** CA en MAD
- **Deux courbes :**
  - CA Caisse (bleu)
  - Seuil de rentabilité (pointillé rouge, fixe à 136 667)
- **Points annotés :** mois exceptionnel (Ramadan, juillet record) avec label
- **Tooltip :** CA, marge estimée, vs même mois N-1

---

## 7. Section Plan d'Action — Top 3

Affiche les 3 premières actions prioritaires depuis la table `action_items` (filtrées par statut ≠ `done`, triées par priorité).

```
┌────────────────────────────────────────┐
│ 🔴 URGENT  Identité soir distincte     │
│            Délai : T2 2026 | Soir      │
├────────────────────────────────────────┤
│ 🔴 URGENT  Autorisation terrasse       │
│            Délai : T2 2026 | Terrasse  │
├────────────────────────────────────────┤
│ 🟡 MOYEN   Catalogue B2B événementiel  │
│            Délai : T2 2026 | B2B       │
└────────────────────────────────────────┘
[Voir toutes les actions →]
```

Chaque action est cliquable et ouvre un modal de détail avec possibilité de changer le statut (`todo` → `in_progress` → `done`).

---

## 8. Accès rapides (boutons)

Trois boutons en bas de page :

| Bouton | Icon | Destination |
|---|---|---|
| Importer CSV | 📤 | `/import` |
| Saisir dépenses | ✏️ | `/saisie` |
| Voir le rapport | 📄 | `/reporting` |

---

## 9. Sélecteur de période

En haut du dashboard, un sélecteur de mois permet de consulter les données d'un mois précédent. Par défaut : mois courant.

```
[< Fév 2026]  [Mars 2026]  [Avr 2026 >]
```

Tous les KPIs et graphiques se mettent à jour en fonction du mois sélectionné.

---

## 10. Comportement responsive

**Mobile (< 640px) :**
- KPI cards : 2 colonnes × 2 lignes
- Graphiques : scrollables horizontalement
- Plan d'action : liste verticale
- Accès rapides : 3 boutons full-width

**Desktop (≥ 1024px) :**
- Layout en 2 colonnes : KPIs + graphique semaine à gauche, graphique annuel + plan d'action à droite
- Sidebar de navigation visible en permanence

---

## 11. Performance

- Données du dashboard chargées via une API route `/api/dashboard?month=YYYY-MM`
- Cache de 5 minutes côté serveur (revalidate)
- Skeleton loading pendant le chargement initial
- Les graphiques s'affichent progressivement (lazy load)

---

## 12. États particuliers

| Cas | Comportement |
|---|---|
| Aucune donnée pour le mois | Message "Aucune donnée — Importer le CSV ou saisir des dépenses" |
| CSV non importé pour le mois courant | Bannière orange "⚠️ CSV caisse non importé pour [mois]" |
| Seuil dépassé ce mois | Badge vert "✅ Seuil atteint" dans le header |
| Aucune action dans le plan | Message "Aucune action prioritaire — Aller configurer les objectifs" |
