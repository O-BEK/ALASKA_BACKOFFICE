# Spec 06 — Objectifs & Plan d'Action

> Module de pilotage stratégique. Admin uniquement. Permet de fixer les objectifs annuels, suivre la progression, et gérer le plan d'action par levier.

---

## 1. Vue d'ensemble

**URL :** `/objectifs`
**Rôle requis :** `admin`

Ce module centralise :
1. L'objectif CA annuel (fixé par Othman)
2. La trajectoire 3 ans
3. Le suivi de progression mensuelle vs objectif
4. Le plan d'action structuré par levier (Soir / Terrasse / B2B)

---

## 2. Structure de la page

```
Onglet 1 : 🎯 Objectifs financiers
Onglet 2 : 🗺️ Plan d'action
Onglet 3 : 📈 Trajectoire 3 ans
```

---

## 3. Onglet 1 : Objectifs Financiers

### 3.1 Objectif annuel

Chaque année, Othman fixe un objectif CA annuel. Les données pré-chargées :

| Année | Cible Othman | Réel | Écart | Statut |
|---|---|---|---|---|
| 2025 (Y1) | 1 400 000 MAD | 1 752 217 MAD | +25,2% | ✅ Dépassé |
| 2026 (Y2) | 2 278 000 MAD | En cours | — | 🔄 En cours |
| 2027 (Y3) | 2 847 000 MAD | — | — | 📅 Futur |

**Pour modifier l'objectif 2026 :**
- Clic sur le chiffre objectif → modal d'édition
- Champ : Objectif CA caisse + Objectif CA B2B séparément
- Date de mise à jour enregistrée

### 3.2 Décomposition mensuelle de l'objectif

L'objectif annuel peut être réparti selon deux modes :

**Mode automatique (égal)** : objectif / 12 mois
**Mode manuel** : ajustement mensuel tenant compte de la saisonnalité

Tableau éditable (admin) :

| Mois | Objectif (MAD) | Réel (MAD) | Écart | Statut |
|---|---|---|---|---|
| Jan 2026 | 165 000 | 213 460 | +29% | ✅ |
| Fév 2026 | 165 000 | 123 472 | -25% | ❌ |
| Mars 2026 | 90 000 | 144 856 | +61% | ✅ |
| Avr 2026 | 190 000 | — | — | ⏳ |
| ... | | | | |

> Note : pour mars 2026, l'objectif est réduit car Ramadan = moins de déjeuners

### 3.3 Graphique progression annuelle

- Barres : CA réel par mois (bleu)
- Ligne : objectif mensuel (tirets orange)
- Indicateur cumulatif en dessous du graphique

```
Progression annuelle 2026
████████████████░░░░░░░░░░░░░░  38%
Réel : 481 788 MAD / Objectif : 2 278 000 MAD
Rythme actuel → projection fin d'année : ~1 927 000 MAD
```

### 3.4 KPIs objectifs

| KPI | Valeur |
|---|---|
| Objectif mensuel moyen | 189 833 MAD |
| CA moyen réel (3 derniers mois) | 160 596 MAD |
| Écart à combler par mois | 29 237 MAD |
| Projection fin d'année (rythme actuel) | 1 927 000 MAD |
| Scénario si leviers activés | 2 278 000 MAD |

---

## 4. Onglet 2 : Plan d'Action

### 4.1 Structure

Les actions sont organisées par **levier** (couleur différente par levier) :

```
LEVIER 1 — 🌙 SERVICE DU SOIR
LEVIER 2 — ☀️ TERRASSE
LEVIER 3 — 💼 B2B / CATERING
LEVIER 4 — 📱 MARKETING DIGITAL
LEVIER 5 — ⚙️ PILOTAGE FINANCIER
```

### 4.2 Carte Action

Chaque action affiche :

```
┌──────────────────────────────────────────┐
│  🔴 URGENT                               │
│  Créer une identité soir distincte       │
│                                          │
│  Levier : Soir  |  Délai : T2 2026       │
│  Budget : 0 MAD |  Impact : Ticket +20%  │
│                                          │
│  Statut : [○ À faire ● En cours ○ Fait]  │
│                                          │
│  Note : Carte soir spécifique, musique,  │
│  éclairage dim, prix cible 200+ MAD      │
│                                          │
│  [✏️ Modifier]  [✅ Marquer comme fait]   │
└──────────────────────────────────────────┘
```

### 4.3 Données initiales pré-chargées

| # | Action | Levier | Priorité | Délai | Budget |
|---|---|---|---|---|---|
| 1.1 | Créer une identité soir distincte (carte, ambiance) | Soir | 🔴 URGENT | T2 2026 | 0 MAD |
| 1.2 | Lancer réservation en ligne dîner | Soir | 🔴 URGENT | T2 2026 | 0-2 000 MAD |
| 1.3 | Communication soir Instagram + Google Posts | Soir | 🔴 URGENT | Immédiat | 3 000 MAD |
| 1.4 | Analyser jours forts soir + optimiser staffing | Soir | 🟡 MOYEN | T2 2026 | 0 MAD |
| 2.1 | Obtenir autorisation terrasse Mairie | Terrasse | 🔴 URGENT | T2 2026 | Frais admin |
| 2.2 | Aménager terrasse (mobilier, parasols) | Terrasse | 🟡 MOYEN | T2 2026 | 25-50 000 MAD |
| 3.1 | Créer catalogue événementiel B2B | B2B | 🟡 MOYEN | T2 2026 | 5 000 MAD |
| 3.2 | Prospecter 5 nouveaux clients corporate | B2B | 🟡 MOYEN | T2 2026 | 0 MAD |
| 3.3 | Relancer ANYA, GIZ, REDAL, UTM, Ambassade Canada | B2B | 🟢 ACTIF | Continu | 0 MAD |
| 4.1 | Mettre à jour menu Google Business Profile | Marketing | 🔴 URGENT | Immédiat | 0 MAD |
| 4.2 | Publier 2x/semaine sur Google Business Profile | Marketing | 🔴 URGENT | Continu | 0 MAD |
| 5.1 | MAJ hebdo tableau de bord (chaque lundi) | Pilotage | 🔴 URGENT | Immédiat | 0 MAD |
| 5.2 | Analyser ratio salaires/CA (cible < 25%) | Pilotage | 🟡 MOYEN | T2 2026 | 0 MAD |
| 5.3 | Préparer offre Ramadan 2027 | Pilotage | 🟡 MOYEN | T4 2026 | 0 MAD |

### 4.4 Filtres et tri

- Filtres : par levier, par priorité, par statut
- Tri : par priorité (défaut), par délai, par impact estimé
- Vue "Urgentes seulement" : affiche uniquement 🔴 URGENT

### 4.5 Ajout d'une nouvelle action

Modal avec champs :
- Titre (obligatoire)
- Levier (sélecteur)
- Priorité (🔴/🟡/🟢)
- Délai (texte libre ou date)
- Budget estimé
- Impact attendu (texte)
- Notes

### 4.6 Compteurs par levier

```
🌙 Soir    : 1/4 actions faites  [████░░░░] 25%
☀️ Terrasse : 0/2 actions faites  [░░░░░░░░]  0%
💼 B2B     : 1/3 actions faites  [███░░░░░] 33%
```

---

## 5. Onglet 3 : Trajectoire 3 Ans

### 5.1 Tableau trajectoire

| Année | Scénario Prudent | Scénario Réaliste | Scénario Ambitieux | Réel |
|---|---|---|---|---|
| 2025 (Y1) | — | — | — | 1 752 217 ✅ |
| 2026 (Y2) | 1 927 439 | **2 277 882** | 2 628 326 | En cours... |
| 2027 (Y3) | 2 120 183 | **2 847 352** | 3 942 489 | — |

La ligne Y2 est éditable : Othman peut ajuster les pourcentages de croissance.

### 5.2 Hypothèses des scénarios

Affichage des hypothèses sous le tableau :

```
Scénario Réaliste (+30% Y2) suppose :
✓ Service soir : 30 000 → 45 000 MAD/mois (+50%)
✓ Terrasse opérationnelle mai-sept : +15 000/mois
✓ B2B : 8 000 → 30 000 MAD/mois (+275%)
✓ Pas de changement sur le midi

Scénario Prudent (+10% Y2) suppose :
✓ Croissance organique uniquement
✓ Aucun levier majeur activé
```

### 5.3 Graphique trajectoire

- Courbe réel (bleu plein jusqu'à aujourd'hui)
- Trois courbes de projection (tirets, couleurs différentes)
- Zone grisée entre prudent et ambitieux
- Axe X : années / Axe Y : CA en MAD

---

## 6. API Routes

```
GET    /api/objectives                  Liste tous les objectifs
POST   /api/objectives                  Crée un objectif annuel
PUT    /api/objectives/:id              Met à jour un objectif
GET    /api/objectives/monthly/:year    Décomposition mensuelle
PUT    /api/objectives/monthly/:id      Modifie objectif d'un mois

GET    /api/action-items                Liste les actions
POST   /api/action-items                Crée une action
PUT    /api/action-items/:id            Modifie / change statut
DELETE /api/action-items/:id            Supprime une action
```
