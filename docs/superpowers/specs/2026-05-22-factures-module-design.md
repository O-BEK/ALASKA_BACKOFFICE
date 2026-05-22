# Module Factures — Design Spec

**Date :** 2026-05-22  
**Projet :** Alaska Pilot — Alaska Neo Bistrot (Rabat, Maroc)  
**Scope :** Émission de factures TVA vers clients B2B, PDF téléchargeable, numérotation auto

---

## Contexte

Alaska Neo Bistrot réalise des prestations B2B (traiteur, événements, repas d'entreprise). Ces prestations doivent être facturées à des entreprises marocaines avec mention TVA 10% (taux restauration Maroc). Le module remplace les factures manuelles Word/Excel par un outil intégré à l'app de pilotage.

Accès : **admin uniquement** (identique à `/charges` et `/import`).

---

## Architecture

### Approche retenue

Module intégré à l'app Next.js existante :
- Table Supabase `invoices` + `invoice_lines`
- Page `/factures` avec liste et formulaire de création
- API routes Next.js pour CRUD et génération PDF
- PDF généré côté serveur via `@react-pdf/renderer`

### Nouveau fichier par couche

| Couche | Fichier |
|---|---|
| Migration SQL | `supabase/migrations/20260522000000_invoices.sql` |
| API CRUD | `app/api/invoices/route.ts` |
| API détail + statut | `app/api/invoices/[id]/route.ts` |
| API PDF | `app/api/invoices/[id]/pdf/route.ts` |
| Composant PDF | `lib/pdf/InvoicePdf.tsx` |
| Hook client | `lib/hooks/useInvoices.ts` |
| Page liste | `app/(dashboard)/factures/page.tsx` |

---

## Base de données

### Table `invoices`

```sql
CREATE TABLE invoices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,   -- FAC-2026-001
  client_name   text NOT NULL,
  client_rc     text,
  client_address text,
  invoice_date  date NOT NULL DEFAULT CURRENT_DATE,
  status        text NOT NULL DEFAULT 'draft', -- draft | sent | paid
  notes         text,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

### Table `invoice_lines`

```sql
CREATE TABLE invoice_lines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description    text NOT NULL,
  quantity       numeric(10,2) NOT NULL DEFAULT 1,
  unit_price_ht  numeric(10,2) NOT NULL,
  tva_rate       numeric(5,2) NOT NULL DEFAULT 10.00,
  line_order     int NOT NULL DEFAULT 0
);
```

### Numérotation automatique

Fonction SQL qui génère le prochain numéro séquentiel :
```sql
-- Exemple : FAC-2026-001, FAC-2026-002 ...
-- Compteur réinitialisé par année
```
Implémenté comme helper serveur dans `lib/server/invoice-utils.ts` — requête `MAX(invoice_number)` filtré par année pour dériver le prochain index.

### RLS

- `SELECT` : `auth_user_role() = 'admin'`
- `INSERT` / `UPDATE` / `DELETE` : `auth_user_role() = 'admin'`

---

## Calculs (jamais stockés)

```
total_ht_ligne = quantity × unit_price_ht
total_ht       = Σ(total_ht_ligne)
tva_amount     = total_ht × 0.10
total_ttc      = total_ht + tva_amount
```

Ces calculs sont effectués à la fois côté client (récapitulatif live dans le formulaire) et côté serveur (PDF).

---

## API Routes

### `GET /api/invoices`
- Auth admin obligatoire
- Retourne la liste paginée : `{ invoices: Invoice[], total: number }`
- Inclut `total_ttc` calculé par requête SQL agrégée sur les lignes

### `POST /api/invoices`
- Auth admin obligatoire
- Body : `{ client_name, client_rc, client_address?, invoice_date, notes?, lines: Line[] }`
- Génère `invoice_number` séquentiel (FAC-YYYY-NNN)
- Insère `invoices` puis `invoice_lines` en transaction
- Retourne la facture créée

### `GET /api/invoices/[id]`
- Auth admin
- Retourne la facture avec ses lignes

### `PATCH /api/invoices/[id]`
- Auth admin
- Body : `{ status: 'draft' | 'sent' | 'paid' }`
- Mise à jour du statut uniquement

### `GET /api/invoices/[id]/pdf`
- Auth admin
- Génère le PDF via `@react-pdf/renderer`
- Retourne `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="FAC-YYYY-NNN.pdf"`

---

## Composant PDF (`lib/pdf/InvoicePdf.tsx`)

Rendu `@react-pdf/renderer` en A4 portrait :

**Sections :**

1. **En-tête émetteur** (Alaska Neo Bistrot)
   - Logo (`/logo.png`)
   - Nom, adresse, RC, ICE — lus depuis variables d'environnement :
     - `NEXT_PUBLIC_COMPANY_NAME` (défaut : "Alaska Neo Bistrot")
     - `NEXT_PUBLIC_COMPANY_ADDRESS`
     - `NEXT_PUBLIC_COMPANY_RC`
     - `NEXT_PUBLIC_COMPANY_ICE`

2. **Bloc client**
   - Nom de l'entreprise, RC

3. **Informations facture**
   - Numéro, date d'émission

4. **Tableau des prestations**
   | Désignation | Qté | PU HT (MAD) | Total HT (MAD) |

5. **Récapitulatif**
   - Total HT
   - TVA 10%
   - **Total TTC** (en gras, mis en avant)

6. **Pied de page**
   - "Facture soumise à la TVA au taux de 10%"
   - "Paiement à réception de la facture sauf accord préalable écrit"

---

## Frontend

### Page `/factures`

- Entrée nav sidebar admin avec icône `FileText` (Lucide), label "Factures"
- Accessible uniquement `role = 'admin'` (middleware existant + vérification serveur)

**Vue liste :**
- Tableau : Numéro | Client | Date | Total TTC | Statut | Actions
- Actions : "Télécharger PDF" (appel `/api/invoices/[id]/pdf`) + badge statut cliquable
- Bouton "Nouvelle facture" → affiche le formulaire en dessous (ou modal)

**Formulaire de création :**
- Champs en-tête : Nom entreprise*, RC*, Adresse, Date
- Section lignes dynamique :
  - Par défaut 1 ligne vide
  - Colonnes : Désignation | Quantité | PU HT | Total HT (calculé)
  - Bouton "+ Ajouter une ligne"
  - Bouton "Supprimer" par ligne (si > 1 ligne)
- Récapitulatif live : Total HT | TVA 10% | **Total TTC**
- Bouton "Enregistrer la facture"

### Hook `lib/hooks/useInvoices.ts`

Pattern identique à `useCharges.ts` :
- `invoices` state
- `loading`, `error`
- `createInvoice(data)`, `updateStatus(id, status)`, `downloadPdf(id)`

---

## Variables d'environnement à ajouter

```env
# .env.example
NEXT_PUBLIC_COMPANY_NAME=Alaska Neo Bistrot
NEXT_PUBLIC_COMPANY_ADDRESS=...
NEXT_PUBLIC_COMPANY_RC=...
NEXT_PUBLIC_COMPANY_ICE=...
```

---

## Tests

- `tests/invoice-utils.test.ts` — teste la génération du numéro séquentiel (première facture de l'année, deuxième, changement d'année)
- `tests/invoice-calculations.test.ts` — teste total HT, TVA, TTC pour plusieurs lignes

---

## Ce qui est hors scope

- Import de factures reçues (fournisseurs)
- Envoi par email
- Gestion des avoirs / factures rectificatives
- Intégration comptable
- Multi-devise (MAD uniquement)
