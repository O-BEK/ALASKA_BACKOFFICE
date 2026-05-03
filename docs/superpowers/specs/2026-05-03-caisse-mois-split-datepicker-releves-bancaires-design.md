# Design — Caisse Mois split + Date pickers + Relevés bancaires

Date: 2026-05-03  
Statut: approuvé

---

## Scope

Deux sprints :

- **Sprint 1** (rapide, sans risque) : split des achats cash dans l'onglet Mois, date picker navigation caisse, centrage date picker import CSV.
- **Sprint 2** (feature lourde) : upload et parsing de relevés bancaires PDF (Banque Populaire + CFG), intégration dans le reporting.

---

## Sprint 1

### 1. Onglet Mois — split des achats cash

**Problème** : `cashMonth.cash_purchases` agrège toutes les dépenses (MP, RH, CHARGES, AUTRE) en une seule ligne, ce qui masque la nature des sorties.

**Solution** : remplacer la ligne unique par trois lignes distinctes.

**Affichage cible** :
```
Cash POS mensuel        :  XX XXX MAD
Mouvements POS          :     XXX MAD
  Achats & charges cash :  -X XXX MAD
  Salaires cash         :  -X XXX MAD
  Dépôt cash banque     :  -X XXX MAD
Cash théorique enveloppe:  XX XXX MAD
CA global indicatif     :  XX XXX MAD
```

**Règles de ventilation** :
- `cash_mp_divers` = dépenses de catégorie `MP` + `AUTRE` + `CHARGES` dont le label n'est **pas** `"Virement banque"` (inclut loyer, électricité, etc. payés en cash)
- `cash_rh` = dépenses de catégorie `RH`
- `cash_depot` = dépenses de catégorie `CHARGES` dont le label est exactement `"Virement banque"`

**Fichiers modifiés** :

| Fichier | Changement |
|---|---|
| `lib/server/analytics.ts` | `buildCashMonthSummary()` retourne `cash_mp_divers`, `cash_rh`, `cash_depot` à la place de `cash_purchases` |
| `lib/contracts.ts` | Schéma Zod `cashMonthSchema` : remplacer `cash_purchases` par les 3 nouveaux champs |
| `lib/hooks/useDashboard.ts` | Mettre à jour le type et la valeur par défaut de `cashMonth` |
| `app/(dashboard)/saisie/page.tsx` | Mois tab : 3 lignes à la place d'une |
| `app/api/dashboard/route.ts` | Vérifier que `cashMonth` est bien transmis (pas de changement de contrat API externe attendu) |

**Compatibilité** : `cash_purchases` était utilisé uniquement dans l'onglet Mois de `/saisie` et dans `analytics.test.ts`. Les tests devront être mis à jour.

---

### 2. Navigation caisse — date picker rapide

**Problème** : pour revenir au début du mois depuis la saisie du jour, il faut cliquer autant de fois que le nombre de jours écoulés.

**Solution** : ajouter un `<input type="date">` centré, discret, entre les flèches de navigation et le bouton "Aujourd'hui".

**Comportement** :
- Valeur initiale = date active courante (format `yyyy-MM-dd`)
- `onChange` → appelle `setActiveDate(parseISO(value))` qui met à jour la date et synchronise `weekStart`
- Le bouton "Aujourd'hui" reste inchangé

**Fichier modifié** : `app/(dashboard)/saisie/page.tsx` — section navigation jour (lignes 146-158), ajout de ~6 lignes.

---

### 3. Import CSV — date picker centré

**Problème** : sur mobile, les inputs "Du" et "Au" ne sont pas centrés.

**Solution** : ajuster les classes Tailwind du conteneur des date pickers dans `app/(dashboard)/import/page.tsx` (lignes 199-219) pour centrer les éléments sur mobile.

**Fichier modifié** : `app/(dashboard)/import/page.tsx` — 1-2 classes Tailwind.

---

## Sprint 2 — Relevés bancaires PDF

### Contexte

CLAUDE.md mentionne un bloc "Consolidation externe" dans `/reporting` comme étape future. Ce sprint l'implémente.

L'utilisateur dispose de deux comptes bancaires : **Banque Populaire** et **CFG Bank**. Les relevés sont exportés en PDF.

### Flux utilisateur

1. Aller sur `/import` → onglet **"Relevés"**
2. Sélectionner la banque (Banque Populaire | CFG)
3. Uploader le PDF du mois
4. Preview : tableau des transactions extraites (date, libellé, débit, crédit, solde)
5. Confirmer → transactions stockées en base, PDF archivé

### Schéma base de données

**Nouvelle table `bank_statement_imports`** :
```sql
id            uuid PK
bank          text  -- 'bp' | 'cfg'
period_start  date
period_end    date
storage_path  text  -- chemin dans bucket bank-statements
imported_at   timestamptz
transaction_count int
user_id       uuid FK auth.users
```

**Nouvelle table `bank_transactions`** :
```sql
id         uuid PK
import_id  uuid FK bank_statement_imports
date       date
label      text
debit      numeric
credit     numeric
balance    numeric
bank       text  -- 'bp' | 'cfg'
```

RLS : lecture/écriture admin uniquement (même pattern que `pos_imports`).

### Stockage

- Bucket Supabase Storage : **`bank-statements`** (privé)
- Path pattern : `{bank}/{year}/{month}/{filename}`
- Policy RLS admin uniquement

### Parsing PDF

- Librairie : `pdf-parse` (déjà dans l'écosystème Next.js, pas de dépendance native lourde)
- Un parser par banque :
  - `lib/bank-parsers/banque-populaire.ts`
  - `lib/bank-parsers/cfg.ts`
- Chaque parser : reçoit le texte brut extrait par `pdf-parse`, retourne `BankTransaction[]`
- Format attendu des relevés marocains : lignes tabulaires `date | libellé | débit | crédit | solde`
- **Limitation** : les parsers peuvent nécessiter un ajustement sur les vrais fichiers (variantes d'agence, version PDF). Les parsers sont conçus pour être facilement modifiables.

### Nouvelles routes API

| Route | Méthode | Description |
|---|---|---|
| `/api/bank-statements` | GET | Liste des imports (par banque, par mois) |
| `/api/bank-statements` | POST | Upload + parse + preview (sans commit) |
| `/api/bank-statements/commit` | POST | Commit les transactions d'un import |
| `/api/bank-statements/[id]` | GET | Transactions d'un import |

Toutes ces routes : admin uniquement.

### Intégration reporting

La page `/reporting` (`app/(dashboard)/reporting/page.tsx`) a déjà un bloc "Consolidation externe". Il sera alimenté par une nouvelle clé `bankConsolidation` dans la réponse de `/api/reporting` :

```typescript
bankConsolidation: {
  banks: Array<{
    bank: 'bp' | 'cfg'
    total_debit: number
    total_credit: number
    import_count: number
    period: string
  }>
  total_debit: number
  total_credit: number
  has_data: boolean
}
```

### Nouvelles migrations

```
supabase/migrations/20260503000000_bank_statements.sql
```

Contient : tables `bank_statement_imports` + `bank_transactions` + bucket `bank-statements` + policies RLS.

---

## Tests à mettre à jour / ajouter

- `tests/analytics.test.ts` : mettre à jour les assertions sur `cashMonth` (3 champs au lieu de `cash_purchases`)
- `tests/bank-parser.test.ts` (nouveau) : tester les parsers BP et CFG avec des extraits de texte PDF représentatifs
- `tests/api-auth.test.ts` : ajouter les routes `/api/bank-statements` dans les tests 403/200

---

## Non dans le scope

- Rapprochement automatique entre transactions bancaires et dépenses caisse (matching)
- Import de relevés bancaires en CSV/Excel (uniquement PDF pour l'instant)
- Notifications ou alertes sur écarts entre caisse et banque
