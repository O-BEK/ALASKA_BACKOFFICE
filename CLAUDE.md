# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project

**Alaska Pilot** — Pilotage financier du restaurant Alaska Neo Bistrot (Rabat). L'application remplace des fichiers Excel manuels par une webapp Next.js mobile-first pour suivre le CA, les dépenses, les charges fixes, les objectifs et le reporting.

Specs métier principales dans `specs/` et compléments de design/plan dans `docs/superpowers/`.

## Current State

Le repo est maintenant sur un **V1 socle stabilisé** (après audit P0 du 2026-04-10) :

- auth réelle via **Supabase Auth** — aucun système legacy (cookie `alaska_session`, `pilot-store`, `api/auth/*` supprimés)
- rôles stockés dans la table `profiles` (RLS strict) — ne plus lire le rôle depuis `user_metadata`
- routes protégées par `middleware.ts` + `lib/supabase/middleware.ts`
- les routes API sensibles (`dashboard`, `reporting`, `objectives`, `import-csv`, `charges`) contrôlent explicitement `auth` / `admin` côté serveur
- persistence partagée dans **Supabase/PostgreSQL**
- seed initial à faire via script explicite — le seed automatique au runtime a été supprimé
- bootstrap auth durci via `service_role` avec attribution des rôles directement dans `profiles`
- l'écran manager ne lit plus les montants de `fixed_charges` quand seule la liste staff est nécessaire
- redirect après login basé sur `profiles.role`, plus sur `user_metadata`
- UI branchée sur des API routes Next.js dans `app/api/`
- tests unitaires/métier avec Vitest

Le projet `claude/` est maintenant pensé pour être **isolé** et publié comme application autonome.

## Commands

```bash
# Development
npm run dev

# Quality
npm run test
npm run lint
npm run build
```

## Architecture

### Route Groups

- `app/(auth)/` — login
- `app/(dashboard)/` — pages protégées
- `app/api/` — endpoints serveur pour lecture et mutations métier

### Auth & Access Control

- Session Supabase gérée via cookies sécurisés
- Middleware dans `middleware.ts`
- Helpers Supabase:
  - `lib/supabase/client.ts`
  - `lib/supabase/server.ts` — contient `getUserRole(supabase, userId)` et `isAdmin(supabase, userId)` pour vérifier le rôle côté API routes
  - `lib/supabase/middleware.ts`
- Rôles stockés dans la table `profiles` — **ne jamais lire le rôle depuis `user.user_metadata`** pour des décisions de sécurité
- Rôles supportés: `admin` et `manager`
- Redirect après login:
  - `admin` → `/`
  - `manager` → `/saisie`
- `manager` est bloqué de `/` (dashboard), `/charges`, `/objectifs`, `/import`, `/reporting`
- Les policies RLS Supabase utilisent `public.auth_user_role()` (fonction SECURITY DEFINER qui lit depuis `profiles`)

Shell applicatif:

- `components/layout/AppShell.tsx`

### Shared Persistence

La source de vérité métier est maintenant Supabase:

- tables principales:
  - `daily_sales` — inclut `mouvement_caisse NUMERIC(10,2)` (champ cash physique)
  - `expenses`
  - `fixed_charges`
  - `objectives`
  - `monthly_objectives`
  - `action_items`
  - `pos_imports`
  - `profiles` — stocke le rôle utilisateur (`admin` | `manager`), alimentée par trigger sur `auth.users`
- migrations:
  - `supabase/migrations/20260407180000_init.sql` — schéma initial
  - `supabase/migrations/20260409000000_action_items_metadata.sql`
  - `supabase/migrations/20260410000000_p0_profiles_schema_fixes.sql` — profiles, mouvement_caisse, RLS complet
  - `supabase/migrations/20260412110000_harden_profile_bootstrap.sql` — `handle_new_user()` force `manager` par défaut et ne lit plus le rôle depuis `user_metadata`

La couche serveur qui hydrate les snapshots UI est:

- `lib/server/supabase-store.ts`

### Server Analytics Layer

Les agrégations communes sont centralisées dans:

- `lib/server/analytics.ts`

Cette couche alimente:

- dashboard mensuel
- vue semaine
- reporting mensuel
- exports CSV

### Client Data Access Pattern

Le pattern cible est:

- UI pages → hooks client
- hooks client → `fetch()` vers `app/api/*`
- API routes → data layer Supabase partagé

Hooks principaux:

- `lib/hooks/useDashboard.ts`
- `lib/hooks/useDailyEntry.ts`
- `lib/hooks/useWeekView.ts`
- `lib/hooks/useWeekEntries.ts`
- `lib/hooks/useCharges.ts`
- `lib/hooks/useUserRole.ts`
- `lib/hooks/useObjectives.ts`
- `lib/hooks/useCaisseBalance.ts`

### Main API Routes

- `app/api/dashboard/route.ts`
- `app/api/daily-entry/route.ts`
- `app/api/week/route.ts`
- `app/api/import-csv/route.ts`
- `app/api/charges/route.ts`
- `app/api/objectives/route.ts`
- `app/api/objectives/alcool-validate/route.ts`
- `app/api/reporting/route.ts`
- `app/api/reporting/export/route.ts`
- `app/api/caisse/balance/route.ts`

## Key Business Rules

### Financial Logic

Toutes les fonctions de calcul partagées vivent dans:

- `lib/calculations.ts`

Règles importantes:

- seuil de rentabilité basé sur `0.28` de coûts variables
- `ca_total = ca_caisse + ca_b2b` est le CA POS complet (espèces + CB)
- `ca_total` alimente : dashboard KPI, breakeven %, marges, reporting, objectifs
- `ca_caisse` seul alimente : `buildCaisseBalance` (solde physique du tiroir-caisse)
- `solde caisse` est l'indicateur de trésorerie physique — intentionnellement limité au cash
- la marge nette est un indicateur analytique calculé sur `ca_total`
- `CAISSE_RESERVE = 1 000 MAD` : réserve semaine conservée dans le tiroir-caisse lors d'un virement banque
- fonds de caisse permanent (1 500 MAD) est physique et hors app
- `buildCaisseBalance(db)` dans `analytics.ts` calcule le solde cumulé historique : `Σ(ca_caisse) - Σ(mouvement_caisse) - Σ(expenses)` — intentionnellement cash only
- les virements banque sont saisis comme dépense label `"Virement banque"`, catégorie `CHARGES`
- `mouvement_caisse` et dépense `"Virement banque"` coexistent avec des rôles distincts :
  - `mouvement_caisse` → alimente uniquement `buildCaisseBalance` (solde physique tiroir)
  - dépense `"Virement banque"` → alimente le reporting analytique et les charges
  - ne jamais les additionner dans le même calcul (risque de double comptage)

### Daily Sales Import Rules

Parser CSV:

- `lib/csv-parser.ts`

Le parser identifie les colonnes `MoyensDePaiements` pour séparer :
- `ca_caisse` = montant espèces (lignes contenant "esp" ou "cash")
- `ca_b2b` = montant CB et autres paiements non-cash

Règles de fusion import:

- `daily_sales` est unique par `date`
- un import CSV remplace `ca_caisse` ET `ca_b2b` du jour avec les valeurs POS
- `notes` existantes sont conservées
- les dépenses existantes du jour ne sont pas écrasées par l'import
- l'historique des imports est enregistré dans `pos_imports`
- le GET `/api/import-csv` retourne aussi un `monthly_summary` agrégé depuis `daily_sales` (jours CSV, jours manuels, CA total par mois) — affiché dans la page import comme "Données en base"

### Expense Categories

Les catégories métier restent:

- `MP`
- `RH`
- `CHARGES`
- `AUTRE`

## Testing

Tests Vitest dans:

- `tests/calculations.test.ts`
- `tests/csv-parser.test.ts`
- `tests/middleware.test.ts` — teste le middleware Supabase avec mocks `@supabase/ssr` (chemin legacy supprimé)
- `tests/analytics.test.ts`

Configuration:

- `vitest.config.ts`

Quand tu modifies auth, import, calculs ou règles de fusion, relance systématiquement:

```bash
npm run test
npm run lint
npm run build
```

## Important Notes for Future Work

- Ne pas réintroduire `localStorage` comme source principale métier.
- `lib/local-store.ts` est désormais legacy et ne doit plus piloter les écrans principaux.
- Ne pas revenir au store JSON `data/pilot-db.json` comme backend principal.
- Le bootstrap des comptes Supabase se fait via `scripts/bootstrap-auth.mjs` avec `SUPABASE_SERVICE_ROLE_KEY`.
- Le trigger `on_auth_user_created` crée la ligne `profiles` avec rôle par défaut `manager`.
- Toute promotion en `admin` doit être faite explicitement dans `profiles`, pas via `user_metadata`.
- Les variables minimales à fournir sont dans `.env.example`.
- Toute nouvelle logique KPI doit passer par la couche serveur partagée pour éviter les divergences entre dashboard, saisie, semaine et reporting.
- Le seed initial des données se fait via un script explicite (`ensureSeedData` dans `supabase-store.ts`) — ne jamais réintroduire le seed automatique au runtime.

## Security Rules

- **Ne jamais lire le rôle depuis `user.user_metadata`** pour des décisions de sécurité — toujours depuis `profiles` via `getUserRole()` ou `isAdmin()` (`lib/supabase/server.ts`).
- **Ne jamais stocker ni dériver le rôle depuis `user_metadata`** — le trigger `handle_new_user` crée désormais un profil `manager` par défaut, et les rôles réels sont attribués explicitement dans `profiles`.
- Les policies RLS utilisent `public.auth_user_role()` (SECURITY DEFINER) — ne pas les réécrire avec `user_metadata`.
- `user_metadata` peut être utilisé pour l'affichage (name, email) mais pas pour le contrôle d'accès.
- Pour les écrans manager, ne pas exposer les montants complets de `fixed_charges` si seule la liste du personnel est nécessaire.

## KPI Rules

- **Ne jamais utiliser `ca_caisse` seul pour les KPIs de CA** — toujours `ca_total = ca_caisse + ca_b2b`.
- `ca_total` alimente : dashboard KPI, breakeven %, marges, reporting, objectifs, vue semaine.
- `ca_caisse` seul alimente uniquement : `buildCaisseBalance` (trésorerie physique).
- `buildCaisseBalance` calcule : `Σ(ca_caisse) - Σ(mouvement_caisse) - Σ(expenses)` — intentionnellement cash only.
- `sanitizeParsedRows` dans `app/api/import-csv/route.ts` doit inclure `ca_b2b` — sans ça les paiements CB sont perdus au commit.
- La page import est mobile-first : sélecteurs de navigation centrés via `self-center sm:self-auto`.

## Maintenance Note

Ce fichier a été mis à jour après le plan P0 (2026-04-10) : suppression du système d'auth legacy, migration vers `profiles`, correction du seed automatique, fix KPI vue semaine.

## Codex Update

Mise à jour réalisée par **Codex** le **2026-04-12**.

Ce que j'ai fait :

- j'ai sécurisé les routes API de lecture sensibles avec des contrôles `auth` et `admin` explicites côté serveur
- j'ai supprimé le fallback mock de `/api/objectives` pour éviter des réponses incohérentes en cas d'erreur RLS
- j'ai séparé l'accès aux charges complètes et l'accès à la seule liste staff utile aux écrans manager
- j'ai corrigé le redirect login pour qu'il lise le rôle depuis `profiles`
- j'ai ajouté `useUserRole()` pour piloter l'UI avec le rôle réel
- j'ai corrigé la cohérence du solde caisse dans la vue semaine en intégrant `mouvement_caisse`
- j'ai durci le bootstrap Supabase: plus d'attribution de rôle via `user_metadata`, création / mise à jour via `service_role`, et migration dédiée pour forcer `manager` par défaut
- j'ai validé le résultat avec `npm test`, `npm run lint`, `npx tsc --noEmit` et `npm run build`
