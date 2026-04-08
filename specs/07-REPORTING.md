# Spec 07 — Reporting & Exports

> Module de génération de rapports. Admin uniquement.

---

## 1. Vue d'ensemble

**URL :** `/reporting`
**Rôle requis :** `admin`

Ce module permet de consulter des rapports synthétiques et d'exporter les données dans différents formats.

---

## 2. Rapports disponibles

### 2.1 Rapport Mensuel

Le rapport mensuel est le principal document de pilotage. Il synthétise toutes les données d'un mois donné.

**Contenu :**

```
ALASKA NEO BISTROT — Rapport Mensuel
Mois : Mars 2026

1. CHIFFRE D'AFFAIRES
   CA Caisse       :  95 656 MAD
   CA B2B          :  49 200 MAD
   CA Total        : 144 856 MAD
   vs mois préc.   :     +16%
   vs mars 2025    :    +116% (Ramadan 2026 vs 2025)
   CA/Jour moyen   :   5 173 MAD (28 jours)

2. DÉPENSES SAISIES
   Matières premières :  X MAD
   Personnel (avances) : X MAD
   Autres              : X MAD
   TOTAL               : X MAD

3. MARGE ESTIMÉE
   Marge brute     : X MAD
   Taux marge      : X%
   vs seuil (136 667) : ██████░░ 70%

4. PERSONNEL — PAIEMENTS DU MOIS
   Ramzi    : X MAD (avances saisies)
   Leila    : X MAD
   ...

5. NOTES DU MOIS
   (notes saisies sur les journées)
```

**Export :** PDF (A4) + CSV

### 2.2 Rapport Annuel

Synthèse de l'année complète avec tous les KPIs :

- CA mensuel (tableau + graphique)
- Évolution des dépenses
- Marge mensuelle
- Comparaison vs objectif Othman
- Progression plan d'action
- Bilan par levier (Soir / Terrasse / B2B)

### 2.3 Rapport Comparaison N vs N-1

Comparaison mois par mois entre deux années :

| Mois | 2025 | 2026 | Δ |
|---|---|---|---|
| Jan | 144 569 | 213 460 | +48% |
| Fév | 153 924 | 123 472 | -20% |
| Mars | 44 250 | 144 856 | +227% |
| ... | | | |

### 2.4 Rapport Charges Mensuelles

Récapitulatif des charges fixes du mois avec réconciliation vs dépenses saisies :

| Poste | Charges fixes (théorique) | Dépenses saisies | Écart |
|---|---|---|---|
| Loyer | 34 000 | 34 000 | 0 |
| Ramzi | X | X | Δ |
| ... | | | |
| **TOTAL** | **98 400** | **X** | **Δ** |

---

## 3. Interface de la page

```
┌──────────────────────────────────────┐
│  📄 REPORTING                        │
│                                      │
│  [Rapport mensuel ▾]                 │
│  Période : [Mars 2026 ▾]             │
│                                      │
│  [Générer le rapport]                │
│                                      │
│  ─────────────────────────────────   │
│                                      │
│  Exports rapides :                   │
│  [📥 CSV toutes dépenses]            │
│  [📥 CSV CA mensuel 2026]            │
│  [📥 PDF rapport mars 2026]          │
│                                      │
│  ─────────────────────────────────   │
│                                      │
│  Derniers rapports générés :         │
│  📄 Rapport Fév 2026 — 03/03/2026   │
│  📄 Rapport Jan 2026 — 04/02/2026   │
└──────────────────────────────────────┘
```

---

## 4. Export CSV

### Export dépenses

Colonnes : `Date, Jour, Catégorie, Poste, Montant, Saisi par, Notes`

### Export CA mensuel

Colonnes : `Date, CA Caisse, CA B2B, CA Total, Part Soir %, CA/Jour, Source, Notes`

### Export plan d'action

Colonnes : `Levier, Action, Priorité, Délai, Budget, Impact, Statut, Modifié le`

---

## 5. Export PDF

Le PDF est généré côté serveur (via une librairie comme `@react-pdf/renderer` ou `puppeteer`).

**Format :** A4 portrait, header Alaska Neo Bistrot, couleurs du branding (#1F3864 / #2E75B6)

**Contenu du PDF mensuel :**
- Page 1 : KPIs principaux + graphique CA
- Page 2 : Tableau dépenses détaillé
- Page 3 : Charges fixes vs dépenses saisies
- Footer : KAYZARAN SARL — Confidentiel — Généré le [date]

---

## 6. Analyse service du soir

Rapport spécifique "Évolution soir" (données issues de l'import CSV) :

| Mois | CA Soir | % Total | Trend |
|---|---|---|---|
| Oct 2024 | ~4% | 🔴 | — |
| Jul 2025 | ~22% | 🚀 | Décollage |
| Jan 2026 | 21% | ✅ | Stable |
| Mars 2026 | 31% | 🌙 | Iftar Ramadan |

Graphique d'évolution mensuelle de la part du soir (objectif : 25-30% stable en 2026).

---

## 7. API Routes

```
GET  /api/reports/monthly?month=YYYY-MM     Données rapport mensuel
GET  /api/reports/annual?year=YYYY          Données rapport annuel
GET  /api/reports/comparison?y1=&y2=        Comparaison deux années
GET  /api/exports/csv/expenses?month=       Export CSV dépenses
GET  /api/exports/csv/ca?year=              Export CSV CA annuel
GET  /api/exports/pdf/monthly?month=        Génération PDF mensuel
```
