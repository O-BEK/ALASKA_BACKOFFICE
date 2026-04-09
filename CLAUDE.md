# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project

**Alaska Pilot** — Pilotage financier du restaurant Alaska Neo Bistrot (Rabat). L'application remplace des fichiers Excel manuels par une webapp Next.js mobile-first pour suivre le CA, les dépenses, les charges fixes, les objectifs et le reporting.

Specs métier principales dans `specs/` et compléments de design/plan dans `docs/superpowers/`.

## Current State

Le repo est maintenant sur un **V1 pilote interne**:

- auth réelle via **Supabase Auth**
- routes protégées par `middleware.ts` + `lib/supabase/middleware.ts`
- persistence partagée dans **Supabase/PostgreSQL**
- données seedées depuis `lib/mock-data.ts` vers Supabase au premier usage admin
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
  - `lib/supabase/server.ts`
  - `lib/supabase/middleware.ts`
- Rôles supportés: `admin` et `manager`
- Redirect après login:
  - `admin` → `/`
  - `manager` → `/saisie`
- `manager` est bloqué de `/charges`, `/objectifs`, `/import`, `/reporting`

Shell applicatif:

- `components/layout/AppShell.tsx`

### Shared Persistence

La source de vérité métier est maintenant Supabase:

- tables principales:
  - `daily_sales`
  - `expenses`
  - `fixed_charges`
  - `objectives`
  - `monthly_objectives`
  - `action_items`
  - `pos_imports`
- migration incluse dans:
  - `supabase/migrations/20260407180000_init.sql`

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
- `solde caisse` est l'indicateur opérationnel principal dans la saisie et la semaine
- la marge nette reste un indicateur analytique
- `CAISSE_RESERVE = 1 000 MAD` : réserve semaine conservée dans le tiroir-caisse lors d'un virement banque
- fonds de caisse permanent (1 500 MAD) est physique et hors app
- `buildCaisseBalance(db)` dans `analytics.ts` calcule le solde cumulé historique : `Σ(ca_caisse) - Σ(expenses)`
- les virements banque sont saisis comme dépense label `"Virement banque"`, catégorie `CHARGES`

### Daily Sales Import Rules

Parser CSV:

- `lib/csv-parser.ts`

Règles de fusion import:

- `daily_sales` est unique par `date`
- un import CSV met à jour les champs caisse du jour
- `ca_b2b` existant est conservé
- `notes` existantes sont conservées
- les dépenses existantes du jour ne sont pas écrasées par l'import
- l'historique des imports est enregistré dans `pos_imports`

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
- `tests/pilot-store.test.ts`
- `tests/middleware.test.ts`
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
- Le bootstrap des comptes Supabase est prévu via `scripts/bootstrap-auth.mjs`.
- Les variables minimales à fournir sont dans `.env.example`.
- Toute nouvelle logique KPI doit passer par la couche serveur partagée pour éviter les divergences entre dashboard, saisie, semaine et reporting.

## Maintenance Note

Ce fichier a été mis à jour par **Codex** pour refléter l'implémentation réelle du repo après le passage à une V1 pilote interne branchée sur Supabase.
