# Spec 04 — Gestion des Charges Fixes

> Module permettant à l'admin de gérer les charges fixes du restaurant, d'ajouter/supprimer des employés, et de simuler l'impact sur la rentabilité.

---

## 1. Vue d'ensemble

**URL :** `/charges`
**Rôle requis :** `admin`

Ce module est le cœur du pilotage financier. Il permet de :
- Consulter les charges fixes actuelles
- Modifier un poste de charge (ex: loyer renégocié)
- Ajouter un employé et voir l'impact immédiat sur le seuil
- Désactiver un employé (fin de contrat) avec date d'effet
- Simuler des scénarios ("et si j'embauche X à Y MAD/mois ?")

---

## 2. Charges fixes initiales (état au 1er avril 2026)

Ces données sont pré-chargées en base à l'initialisation :

| Catégorie | Poste | Montant/mois | Type | Actif depuis |
|---|---|---|---|---|
| Immobilier | Loyer | 34 000 MAD | Fixe | Oct 2024 |
| Personnel | Salaires (total) | ~36 500 MAD | Semi-fixe | Oct 2024 |
| Énergie | Électricité / Redal | 6 000 MAD | Variable | Oct 2024 |
| Énergie | Gaz | 1 800 MAD | Variable | Oct 2024 |
| Télécoms | Internet | 500 MAD | Fixe | Oct 2024 |
| Transport | Transport / Courses | 6 200 MAD | Variable | Oct 2024 |
| Divers | Charges annexes | 10 000 MAD | Variable | Oct 2024 |
| **TOTAL** | | **~98 400 MAD** | | |

### Personnel détaillé (salaires par employé)

| Nom | Poste | Salaire/mois | Date paiement | Actif |
|---|---|---|---|---|
| Ramzi | Cuisinier | — | 1er du mois | ✅ |
| Leila | Serveuse | — | 21 du mois | ✅ |
| Noeman | Cuisinier | — | 1er du mois | ✅ |
| Mike | Responsable | — | 1er du mois | ✅ |
| Paul | Serveur | — | 17 du mois | ✅ |
| Adil | Serveur | — | 21 du mois | ✅ |
| Glody | Cuisine | — | 21 du mois | ✅ |
| Aicha | Serveuse | — | 21 du mois | ✅ |
| Chaimae | Caisse/Accueil | — | 24 du mois | ✅ |

> Note : les montants exacts des salaires individuels sont à renseigner par Othman lors de l'initialisation (données confidentielles).

---

## 3. Structure de la page

```
┌─────────────────────────────────────┐
│  ⚙️ CHARGES FIXES                    │
│  Total actuel : 98 400 MAD/mois     │
│  Seuil rentabilité : 136 667 MAD    │
├─────────────────────────────────────┤
│  [+ Ajouter une charge]  [Simuler]  │
├─────────────────────────────────────┤
│  📍 IMMOBILIER                      │
│  ├ Loyer    34 000 MAD  [✏️] [🗑️]   │
├─────────────────────────────────────┤
│  👥 PERSONNEL (9 employés)          │
│  ├ Ramzi    X MAD   1er  [✏️] [🗑️] │
│  ├ Leila    X MAD   21   [✏️] [🗑️] │
│  ├ ...                              │
│  ├ [+ Ajouter un employé]           │
├─────────────────────────────────────┤
│  ⚡ ÉNERGIE                         │
│  ├ Électricité  6 000 MAD  [✏️]     │
│  ├ Gaz          1 800 MAD  [✏️]     │
├─────────────────────────────────────┤
│  📦 AUTRES                          │
│  ├ Internet   500 MAD  [✏️]         │
│  ├ Transport  6 200 MAD  [✏️]       │
│  ├ Divers     10 000 MAD  [✏️]      │
└─────────────────────────────────────┘
```

---

## 4. Actions CRUD sur les charges

### 4.1 Modifier une charge
- Clic sur ✏️ → modal avec champ montant + date d'effet
- Si date d'effet = "immédiatement" → mise à jour de la ligne active
- Si date d'effet = future → créer une nouvelle ligne avec `start_date` future (l'ancienne passe `end_date = date d'effet - 1 jour`)
- Le seuil se met à jour en temps réel dans le modal

### 4.2 Ajouter un employé
Modal avec champs :
- Prénom/Nom
- Poste (sélecteur : Cuisinier / Serveur / Responsable / Caisse / Autre)
- Salaire mensuel (MAD)
- Date de paiement (1er, 15, 21, 24, fin de mois, ou date libre)
- Date d'entrée (début de prise en compte)

### 4.3 Désactiver un employé (fin de contrat)
- Clic sur 🗑️ → "Désactiver cet employé ?" + date de fin
- L'employé n'est pas supprimé de la base (historique préservé)
- Passe au statut `inactive` avec `end_date` renseignée
- Le salaire est retiré du total des charges à partir de la date de fin

### 4.4 Ajouter une charge non-personnel
- Bouton "+ Ajouter une charge"
- Champs : Nom, Catégorie (dropdown), Montant/mois, Type (Fixe/Variable/Semi-fixe), Date début

---

## 5. Module Simulation "Et si..."

**Accès :** bouton `[Simuler]` en haut de page

Ce mode permet de créer un scénario hypothétique sans modifier les données réelles.

### Interface simulation

```
┌──────────────────────────────────────┐
│  🔮 SIMULATEUR DE CHARGES            │
│                                      │
│  Charges actuelles : 98 400 MAD/mois │
│  Seuil actuel : 136 667 MAD/mois     │
│                                      │
│  Modifications simulées :            │
│  [+ Ajouter un employé fictif]       │
│  [+ Modifier une charge]             │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Exemple : +1 cuisinier       │    │
│  │ Salaire : [____] MAD         │    │
│  └──────────────────────────────┘    │
│                                      │
│  Nouvelles charges : 108 400 MAD     │
│  Nouveau seuil     : 150 556 MAD     │
│  Δ seuil           : +13 889 MAD     │
│                                      │
│  ⚠️ Avec ce changement, il faudra    │
│  atteindre 150 556 MAD/mois pour     │
│  être rentable (vs 136 667 actuel)   │
│                                      │
│  CA moyen 2025 : 136 338/mois        │
│  → Ce scénario passe le seuil sous   │
│    votre CA moyen de 2025.           │
│                                      │
│  [Réinitialiser]  [Appliquer réellement]
└──────────────────────────────────────┘
```

### Calcul du nouveau seuil
```
Nouveau seuil = Nouvelles charges fixes / Taux de marge sur coût variable
Taux marge = 1 - taux charges variables (défaut : 72% soit 1 - 0.28)
```

---

## 6. Historique des changements de charges

Chaque modification est enregistrée dans `charge_history` :
- Date de modification
- Poste modifié
- Ancienne valeur
- Nouvelle valeur
- Auteur
- Raison (champ texte optionnel)

Visible dans un onglet "Historique" de la page charges.

---

## 7. Saisie taux de charges variables

Dans les paramètres de la page :
- **Taux matières premières estimé** : défaut 28% (ajustable)
- Ce taux sert au calcul : `Seuil = Charges fixes / (1 - taux MP)`
- Si Othman affine ce taux (ex: après analyse réelle), il peut le modifier ici
- Historique des valeurs successives

---

## 8. Alertes automatiques

Après modification d'une charge, si le nouveau seuil dépasse le CA moyen des 3 derniers mois :

> "⚠️ Attention : avec ce changement, votre seuil de rentabilité (156 000 MAD) dépasse votre CA moyen des 3 derniers mois (143 000 MAD). Vérifiez que la croissance attendue justifie cette charge."

---

## 9. Export des charges

Bouton "Exporter" en haut de page :
- **PDF** : tableau des charges au format A4 (pour comptable)
- **CSV** : données brutes toutes les charges actives
