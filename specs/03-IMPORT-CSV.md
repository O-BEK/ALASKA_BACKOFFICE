# Spec 03 — Import CSV Caisse

> Permet à l'admin de charger le rapport mensuel exporté depuis le logiciel de caisse et de mettre à jour la base de données automatiquement.

---

## 1. Contexte

Le logiciel de caisse (POS) génère un fichier CSV mensuel avec toutes les transactions. Ce fichier est le fichier `ventes_DDMMYYYY_HHMMSS.csv` — format fixe, toujours le même depuis l'ouverture (oct. 2024).

**Fréquence d'import :** 1 fois par mois (en début du mois suivant, ou à tout moment)
**Rôle requis :** `admin` uniquement
**URL :** `/import`

---

## 2. Format du fichier CSV source

### Structure des colonnes
Le fichier CSV contient les colonnes suivantes (séparateur `;` ou `,` selon export) :

```
Date | Heure | N° Ticket | Table | Vendeur | Article | Catégorie | Qté | PU HT | Montant HT | TVA | Montant TTC | Mode paiement | Notes
```

### Exemples de lignes réelles
```csv
07/04/2026;12:34;T-00123;12;Mike;Burger Alaska;PLATS;1;95.00;95.00;0;95.00;ESPECES;
07/04/2026;13:02;T-00124;5;Leila;Eau minérale;BOISSONS;2;15.00;30.00;0;30.00;CB;
```

### Ce qui nous intéresse
- **Date** → agréger le CA par jour
- **Montant TTC** → CA caisse du jour
- **Heure** → détecter la part du service soir (≥ 19h00)
- **Mode paiement** → répartition espèces/CB (optionnel, phase 2)

---

## 3. Flux d'import

```
1. Upload fichier CSV
      ↓
2. Validation format (colonnes présentes ?)
      ↓
3. Parsing : agréger par date + heure
      ↓
4. Détection doublons (dates déjà importées)
      ↓
5. Preview : tableau résumé avant confirmation
      ↓
6. Confirmation utilisateur
      ↓
7. Insertion en base (daily_sales + pos_imports)
      ↓
8. Rapport d'import (X jours importés, Y lignes traitées)
```

---

## 4. Page Import — UI

### Étape 1 : Upload

```
┌──────────────────────────────────────┐
│  📤 IMPORT RAPPORT CAISSE            │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Glisser-déposer le CSV ici    │  │
│  │  ou cliquer pour sélectionner  │  │
│  │  [Choisir un fichier]          │  │
│  └────────────────────────────────┘  │
│                                      │
│  Formats acceptés : .csv             │
│  Taille max : 10 MB                  │
│                                      │
│  Derniers imports :                  │
│  ✅ Mars 2026 — 28 jours — 07/04    │
│  ✅ Fév 2026 — 28 jours — 03/03     │
│  ✅ Jan 2026 — 31 jours — 02/02     │
└──────────────────────────────────────┘
```

### Étape 2 : Preview après parsing

```
┌──────────────────────────────────────┐
│  📊 APERÇU — Avril 2026              │
│                                      │
│  Fichier : ventes_07042026.csv       │
│  Lignes traitées : 3 240             │
│  Période détectée : 01/04 → 07/04    │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Date    │ CA (MAD) │ Soir % │  │
│  │ 01/04   │ 2 590    │ 18%    │  │
│  │ 02/04   │ 1 721    │ 22%    │  │
│  │ ...     │ ...      │ ...    │  │
│  └────────────────────────────────┘  │
│                                      │
│  ⚠️ 2 jours déjà en base (01/04,    │
│     02/04) — seront mis à jour       │
│                                      │
│  [Annuler]    [✅ Confirmer l'import] │
└──────────────────────────────────────┘
```

### Étape 3 : Confirmation

```
✅ Import terminé !
   - 7 jours importés
   - 3 240 lignes traitées
   - CA total : 18 106 MAD
   - 2 jours mis à jour (doublons remplacés)

[Voir le dashboard →]
```

---

## 5. Logique de parsing (`lib/csv-parser.ts`)

### Algorithme
```typescript
interface DailySale {
  date: string;        // YYYY-MM-DD
  ca_caisse: number;   // somme Montant TTC du jour
  ca_soir: number;     // somme Montant TTC avec heure >= 19:00
  tickets_count: number;
  source: 'csv_import';
  imported_at: string;
}

function parseCSV(csvContent: string): DailySale[] {
  // 1. Détecter le séparateur (;  ou ,)
  // 2. Parser chaque ligne
  // 3. Grouper par date (col 0)
  // 4. Pour chaque groupe :
  //    - Sommer les Montants TTC (col 11)
  //    - Identifier les lignes avec heure >= 19:00 (col 1) pour ca_soir
  //    - Compter les tickets uniques (col 2)
  // 5. Retourner un tableau DailySale[]
}
```

### Validation du format
```typescript
function validateCSVFormat(headers: string[]): boolean {
  // Vérifier que les colonnes Date, Heure, Montant TTC sont présentes
  // Colonnes requises (par index ou nom) :
  // - Index 0 ou header contenant "date"
  // - Index 1 ou header contenant "heure"
  // - Index 11 ou header contenant "ttc" ou "montant"
}
```

### Gestion des cas particuliers
- Lignes vides → ignorer
- Montants négatifs (remboursements/annulations) → inclure dans le calcul (peuvent réduire le CA)
- Dates hors de la plage attendue → warning mais import possible
- Encoding : UTF-8, fallback Latin-1 (pour accents)

---

## 6. Gestion des doublons

Si des dates du CSV sont déjà en base :

**Stratégie : UPSERT (remplacer)**
- Si `daily_sales` contient déjà la date ET la source est `csv_import` → remplacer
- Si la source est `manual` (saisie manuelle du manager) → afficher warning et demander confirmation
  - "La journée du [date] a été saisie manuellement. Voulez-vous la remplacer par les données du CSV ?"

**Règle métier :** le CSV caisse est la source de vérité pour le CA. La saisie manuelle est un fallback.

---

## 7. Calcul part du soir

Après chaque import, calculer et stocker dans `daily_sales` :

```
ca_soir = Σ(Montant TTC) pour toutes lignes avec Heure >= "19:00"
pct_soir = ca_soir / ca_caisse * 100
```

Cette donnée alimente :
- Le dashboard (part soir ce mois)
- Les graphiques d'évolution du service soir
- Les KPIs de l'objectif "Renforcer le soir"

---

## 8. Historique des imports

Table `pos_imports` :

| Champ | Type | Description |
|---|---|---|
| id | uuid | PK |
| filename | text | Nom du fichier uploadé |
| imported_at | timestamp | Date/heure d'import |
| imported_by | uuid | FK → users |
| rows_processed | int | Nb lignes CSV traitées |
| days_imported | int | Nb jours distincts importés |
| date_range_start | date | Premier jour du CSV |
| date_range_end | date | Dernier jour du CSV |
| ca_total | numeric | CA total importé |
| status | text | `success` / `error` / `partial` |

La page `/import` affiche les 12 derniers imports dans la section "Historique".

---

## 9. Stockage du fichier CSV brut

- Uploader le fichier dans **Supabase Storage** (bucket `pos-imports`, accès privé)
- Path : `pos-imports/{year}/{month}/{filename}`
- Conserver pour audit/relecture si besoin
- Pas de limite de rétention définie (les fichiers sont petits, ~500KB/mois)

---

## 10. Messages d'erreur

| Erreur | Message |
|---|---|
| Fichier non CSV | "Format non supporté. Veuillez importer un fichier .csv" |
| Colonnes manquantes | "Format CSV non reconnu. Vérifiez que c'est bien un export de votre logiciel de caisse." |
| Fichier vide | "Le fichier est vide." |
| Toutes dates déjà importées | "Toutes les données de cette période sont déjà en base." |
| Erreur upload réseau | "Échec de l'upload. Vérifiez votre connexion et réessayez." |
