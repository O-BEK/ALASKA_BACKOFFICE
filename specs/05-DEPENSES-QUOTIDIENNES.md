# Spec 05 — Saisie des Dépenses Quotidiennes

> Module de saisie journalière accessible à l'admin ET au manager. C'est la version Next.js améliorée du fichier HTML de suivi.

---

## 1. Vue d'ensemble

**URL :** `/saisie`
**Rôle requis :** `admin` + `manager`

Ce module permet au responsable du restaurant de saisir chaque jour :
- Le CA caisse (si le CSV mensuel n'a pas encore été importé)
- Les dépenses du jour (matières premières, paiements au personnel, divers)

C'est la **seule page** à laquelle le manager a accès.

---

## 2. Architecture de la page

### Trois onglets (tab navigation)

```
[✏️ Saisie] [📅 Semaine] [📆 Mois]
```

- **Saisie** : formulaire du jour sélectionné
- **Semaine** : vue résumée des 7 jours de la semaine courante
- **Mois** : synthèse mensuelle (dépenses uniquement — pas les KPIs complets du dashboard admin)

---

## 3. Onglet Saisie

### 3.1 Sélecteur de date

```
[‹]  Lundi 7 avril 2026  [›]
     [Aujourd'hui]
```

Navigation jour par jour. Bouton "Aujourd'hui" pour revenir au jour courant.

Indicateur d'état à droite de la date :
- ✅ Vert : CA + dépenses déjà saisis
- 🟡 Orange : partiellement saisi (l'un ou l'autre)
- ⬜ Gris : rien de saisi
- 📤 Bleu : données provenant d'un import CSV (CA en lecture seule)

### 3.2 Section CA Caisse

```
┌────────────────────────────────┐
│  💰 CA Caisse du jour          │
│                                │
│  [         2 590    ] MAD      │
│                                │
│  +500  +1000  +2000  +5000     │
│                                │
│  Notes : [Ramadan, Iftar soir] │
│                                │
│  Source : ○ Saisie manuelle    │
│           ● Import CSV (verrou)│
└────────────────────────────────┘
```

**Règles :**
- Si la date a un CA issu d'un import CSV → champ en lecture seule avec mention "Données caisse — Import CSV du [date]"
- Si saisie manuelle → éditable librement
- Les boutons +X ajoutent au montant existant
- Champ `notes` : texte libre (Ramadan, groupe, événement B2B, etc.)

### 3.3 Section Dépenses

Organisée en trois groupes expansibles :

#### Groupe 1 : 🥩 Matières Premières

| Poste | Champ |
|---|---|
| Poissonnier | Input MAD |
| Boucher | Input MAD |
| Poulet | Input MAD |
| Courses / Marché | Input MAD |
| Eau | Input MAD |
| Technicien / Réparations | Input MAD |
| Autre MP | Input MAD |

#### Groupe 2 : 👥 Personnel (avances & paiements)

Un input par employé actif (liste dynamique issue de la table `fixed_charges` où type = 'salaire') :

| Employé | Champ | Jour de paiement habituel |
|---|---|---|
| Othman | Input MAD | — |
| Ramzi | Input MAD | 1er |
| Paul | Input MAD | 17 |
| Mike | Input MAD | 1er |
| Noeman | Input MAD | 1er |
| Leila | Input MAD | 21 |
| Chaimae | Input MAD | 24 |
| Aicha | Input MAD | 21 |
| Adil | Input MAD | 21 |
| Glody | Input MAD | 21 |
| Ismail | Input MAD | — |

**Comportement :** les champs à 0 sont repliés par défaut pour ne pas encombrer. Seuls les champs avec une valeur > 0 sont affichés en plein, les autres sont réduits. Bouton "Afficher tous" pour voir le formulaire complet.

#### Groupe 3 : 📦 Autres Charges

| Poste | Champ |
|---|---|
| Loyer (si payé ce jour) | Input MAD |
| Électricité / Facture | Input MAD |
| Gaz | Input MAD |
| Internet | Input MAD |
| Autre | Input MAD + label texte |

### 3.4 Récapitulatif en bas de formulaire

```
┌────────────────────────────────────┐
│  CA Caisse          :  2 590 MAD   │
│  Total dépenses     : -1 980 MAD   │
│  ─────────────────────────────     │
│  Marge nette estimée:    610 MAD   │
│  Taux de marge      :    23,6%     │
│                                    │
│  [  Enregistrer  ]                 │
└────────────────────────────────────┘
```

### 3.5 Comportement du bouton Enregistrer

- Si CA = 0 et dépenses > 0 : enregistrer quand même (journée sans CA mais avec dépenses)
- Si tout à 0 : warning "Rien à enregistrer. Voulez-vous quand même sauvegarder ?"
- Après enregistrement : toast "✅ Journée du [date] enregistrée"
- Auto-save : sauvegarde automatique après 2 secondes d'inactivité (debounce) pour éviter les pertes

---

## 4. Onglet Semaine

```
┌──────────────────────────────────────┐
│  Semaine du 31 mars au 6 avril 2026  │
│  [‹ Semaine préc.]  [Sem. suivante ›]│
├──────────────────────────────────────┤
│  CA    : 18 106 MAD                  │
│  Dép.  :  6 840 MAD                  │
│  Marge :  11 266 MAD  (62%)          │
│  Seuil hebdo : 31 566 MAD ● 57%      │
├──────────────────────────────────────┤
│  Lun 31/03  4 965 ✅  Dép: 1 580    │
│  Mar 01/04  2 590 ✅  Dép: 4 760    │
│  Mer 02/04  1 721 🟡  Dép: 1 799    │
│  Jeu 03/04  3 840 ✅  Dép: 2 926    │
│  Ven 04/04  1 884 ✅  Dép: 2 872    │
│  Sam 05/04  4 271 ✅  Dép: 6 846    │
│  Dim 06/04  ——   ⬜  (non saisi)    │
├──────────────────────────────────────┤
│  Dépenses par poste cette semaine :  │
│  Othman      9 050 MAD ████████░░    │
│  Boucher     1 964 MAD ████░░░░░░    │
│  Courses     2 236 MAD █████░░░░░    │
│  Noeman      2 000 MAD ████░░░░░░    │
│  ...                                 │
└──────────────────────────────────────┘
```

Chaque ligne de jour est cliquable → redirige vers l'onglet Saisie avec ce jour sélectionné.

---

## 5. Onglet Mois (vue manager)

Vue simplifiée du mois en cours (ou sélectionnable) :

```
┌──────────────────────────────────────┐
│  Avril 2026  [‹] [›]                 │
│                                      │
│  Total dépenses saisies : 24 800 MAD │
│  Jours saisis : 7/7 (ce mois)        │
│                                      │
│  Par catégorie :                     │
│  MP (Boucher, Poissonnier...) 4 200  │
│  Personnel (avances/paiements) 18 600│
│  Autres                         2 000│
│                                      │
│  [Exporter ce mois en CSV]           │
└──────────────────────────────────────┘
```

> Note : le manager voit uniquement les dépenses. Il ne voit pas les marges, le seuil, les projections.

---

## 6. Règles métier

### Cohérence avec les charges fixes
Quand le manager saisit un paiement de salaire, c'est un "paiement d'avance" ou paiement partiel sur le mois. La **réconciliation** avec les charges fixes mensuelles est faite dans le module Reporting (admin uniquement), pas dans ce module.

### Données partagées
- Les saisies du manager sont visibles par l'admin en temps réel
- L'admin peut modifier ou supprimer toute saisie
- Le manager ne peut modifier que ses propres saisies du jour courant et des 7 derniers jours (pas de modification d'historique ancien)

### Indicateur de statut du CA
Si le CA du jour a été importé via CSV → afficher l'info : "CA importé le [date] — [X] transactions"

---

## 7. Composants UI à développer

| Composant | Description |
|---|---|
| `<DateNavigator>` | Sélecteur jour avec flèches |
| `<ExpenseGroup>` | Groupe dépliable (MP / Personnel / Autres) |
| `<ExpenseRow>` | Ligne individuelle (label + input + total) |
| `<DailySummaryCard>` | Récap CA / Dépenses / Marge |
| `<WeekRow>` | Ligne dans la vue semaine |
| `<WeekDepenses>` | Barres horizontales dépenses semaine |
| `<MonthSummary>` | Vue mois simplifiée manager |

---

## 8. API Routes nécessaires

```
GET  /api/expenses?date=YYYY-MM-DD          Récupère dépenses + CA d'un jour
POST /api/expenses                           Crée/met à jour une journée
GET  /api/expenses/week?start=YYYY-MM-DD     Agrège 7 jours
GET  /api/expenses/month?month=YYYY-MM       Agrège un mois (dépenses)
DELETE /api/expenses/:id                     Supprime une dépense (admin)
```
