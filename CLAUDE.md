# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project

**Alaska Pilot** — Pilotage financier du restaurant Alaska Neo Bistrot (Rabat). L'application remplace des fichiers Excel manuels par une webapp Next.js mobile-first pour suivre le CA, les dépenses, les charges fixes, les objectifs et le reporting.

Specs métier principales dans `specs/` et compléments de design/plan dans `docs/superpowers/`.

## Current State

Le repo est en **V1 interne validée** (lancée le 2026-04-14) :

- auth réelle via **Supabase Auth** — aucun système legacy (cookie `alaska_session`, `pilot-store`, `api/auth/*` supprimés)
- rôles stockés dans la table `profiles` (RLS strict) — ne plus lire le rôle depuis `user_metadata`
- routes protégées par `middleware.ts` + `lib/supabase/middleware.ts`
- les routes API sensibles (`dashboard`, `reporting`, `objectives`, `import-csv`, `charges`) contrôlent explicitement `auth` / `admin` côté serveur
- persistence partagée dans **Supabase/PostgreSQL**
- seed initial via script explicite `scripts/seed-demo-data.mjs` — zéro seed automatique au runtime
- `lib/server/supabase-store.ts` n'importe plus `lib/mock-data.ts` — aucun mock en runtime
- bootstrap auth durci : refuse les variables manquantes, mots de passe par défaut et < 12 chars
- import CSV : au commit, re-parse toujours depuis le contenu brut (`content`), jamais depuis les données client
- fichiers sources POS archivés dans Supabase Storage (bucket privé `pos-imports`), `pos_imports.storage_path` renseigné
- `charge_history` écrit à chaque modification/désactivation de charge
- `scripts/import-pos-csv.mjs` déprécié — chemin recommandé : interface `/import` ou `/api/pos-sync`
- l'écran manager ne lit plus les montants de `fixed_charges` quand seule la liste staff est nécessaire
- redirect après login basé sur `profiles.role`, plus sur `user_metadata`
- routes opérationnelles Caisse/Saisie (`daily-entry`, `week`, `caisse/balance`, `charges`) durcies pour ne plus masquer les erreurs API côté hooks
- sync POS ventes capable de traiter une réponse CSV ou Excel (`.xls/.xlsx`) selon le format renvoyé par l'API POS
- reporting recentré sur les données réellement disponibles : ventes POS, cash suivi, qualité de consolidation, projections et scénarios
- UI branchée sur des API routes Next.js dans `app/api/`
- tests unitaires/métier avec Vitest — 8 fichiers, 30 tests
- validation staging réalisée le 2026-04-14 avec vrais comptes admin + manager

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
  - `daily_sales` — inclut `mouvement_caisse`, `cash_sales_journal`, `cash_movements_journal`, `cash_opening_fund`, `cash_closing_fund`, `cash_journal_sessions`, `cash_journal_anomaly`, `cash_journal_import_id`
  - `expenses`
  - `fixed_charges`
  - `charge_history` — historique des modifications de charges fixes
  - `objectives`
  - `monthly_objectives`
  - `action_items`
  - `pos_imports` — inclut `storage_path` (fichier source archivé) et `import_type` (`sales_csv` | `cash_journal_xls`)
  - `expense_sections` / `expense_item_templates` — modèles de saisie configurables
  - `profiles` — stocke le rôle utilisateur (`admin` | `manager`), alimentée par trigger sur `auth.users`
- migrations appliquées en production :
  - `supabase/migrations/20260407180000_init.sql` — schéma initial
  - `supabase/migrations/20260409000000_action_items_metadata.sql`
  - `supabase/migrations/20260410000000_p0_profiles_schema_fixes.sql` — profiles, mouvement_caisse, RLS complet
  - `supabase/migrations/20260410001000_expense_templates.sql` — sections et modèles de dépenses
  - `supabase/migrations/20260412110000_harden_profile_bootstrap.sql` — `handle_new_user()` force `manager` par défaut
  - `supabase/migrations/20260413101500_cash_journal_v1.sql` — colonnes journal caisse sur `daily_sales`, `import_type` sur `pos_imports`
  - `supabase/migrations/20260414141612_pos_imports_storage_bucket.sql` — bucket privé `pos-imports` + policy RLS admin

La couche serveur qui hydrate les snapshots UI est:

- `lib/server/supabase-store.ts`

Archivage Storage des imports POS :

- `lib/server/import-storage.ts` — helper upload/download bucket `pos-imports`

### Server Analytics Layer

Les agrégations communes sont centralisées dans:

- `lib/server/analytics.ts`

Cette couche alimente:

- dashboard mensuel
- vue semaine
- reporting mensuel
- exports CSV
- projections intelligentes: run-rate mensuel, scénario alcool, trajectoire multi-années

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
- `app/api/pos-sync/route.ts`
- `app/api/pos-sync/journal/route.ts`
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
- `buildCaisseBalance(db)` dans `analytics.ts` calcule le solde caisse sur la semaine courante par défaut : `Σ(cash_sales_reference) + Σ(cash_movements_reference) - Σ(expenses)` — intentionnellement cash only
- les virements banque sont saisis comme dépense label `"Virement banque"`, catégorie `CHARGES`
- `mouvement_caisse` et dépense `"Virement banque"` coexistent avec des rôles distincts :
  - `mouvement_caisse` → alimente uniquement `buildCaisseBalance` (solde physique tiroir)
  - dépense `"Virement banque"` → alimente le reporting analytique et les charges
  - ne jamais les additionner dans le même calcul (risque de double comptage)

### Daily Sales Import Rules

Parser CSV:

- `lib/csv-parser.ts`
- `parseSalesRows()` est la logique commune d'agrégation ventes POS utilisée par le CSV et par Excel

Le parser identifie les colonnes `MoyensDePaiements` pour séparer :
- `ca_caisse` = montant espèces (lignes contenant "esp" ou "cash")
- `ca_b2b` = montant CB et autres paiements non-cash

Parser Excel ventes POS:

- `lib/sales-workbook-parser.ts`
- utilisé par `app/api/pos-sync/route.ts`
- la route lit la réponse POS en `arrayBuffer`, détecte CSV vs Excel via `Content-Type`, `Content-Disposition`, extension fichier et signature binaire, puis tente le bon parser avec fallback
- ne pas revenir à `res.text()` seul dans `/api/pos-sync`, sinon les exports `.xls/.xlsx` seront lus comme du texte et l'import cassera

Journal caisse Excel:

- `lib/pos-journal-parser.ts`
- utilisé par `app/api/pos-sync/journal/route.ts`
- alimente `cash_sales_journal`, `cash_movements_journal`, fonds ouverture/fermeture, sessions et anomalies

Règles de fusion import:

- `daily_sales` est unique par `date`
- un import CSV remplace `ca_caisse` ET `ca_b2b` du jour avec les valeurs POS
- `notes` existantes sont conservées
- les dépenses existantes du jour ne sont pas écrasées par l'import
- l'historique des imports est enregistré dans `pos_imports`
- au commit CSV, le serveur re-parse toujours depuis le contenu brut (`content`) — les données `parsed` envoyées par le client ne sont pas utilisées au commit
- chaque import validé possède un `storage_path` non nul dans `pos_imports`
- le GET `/api/import-csv` retourne aussi un `monthly_summary` agrégé depuis `daily_sales` (jours CSV, jours manuels, CA total par mois) — affiché dans la page import comme "Données en base"
- chemin recommandé pour importer du POS : interface `/import` ou `/api/pos-sync` — `scripts/import-pos-csv.mjs` est déprécié

### Reporting Rules

Le reporting n'est pas une comptabilité exhaustive tant que les virements bancaires, factures fournisseurs et charges hors caisse ne sont pas importés.

Règles de présentation:

- éviter de présenter les dépenses cash comme une "répartition des charges" complète
- distinguer explicitement:
  - ventes POS et mix d'encaissement
  - cash suivi dans la caisse
  - achats cash saisis
  - qualité de consolidation des imports
  - projections et scénarios
- les blocs remplacés volontairement: dépenses par poste, répartition dépenses, réconciliation charges, paiements personnel, notes du mois
- bloc "Consolidation externe" dans `/reporting`: prépare l'étape future d'import PDF bancaire/fournisseur pour consolider virements et charges hors caisse

### Projection Rules

Projection simple mensuelle:

- `projected_ca = ca_per_day * jours_du_mois` quand le mois a déjà des jours saisis/importés
- cible suivie = objectif mensuel si présent, sinon seuil de rentabilité
- `required_daily = max(cible - ca_total, 0) / jours_restants`

Projection intelligente reporting:

- calculée dans `buildSmartProjection()` (`lib/server/analytics.ts`)
- exposée via `smartProjection` dans `/api/reporting`
- utilise:
  - run-rate du mois sélectionné pour le mois courant
  - objectifs mensuels futurs quand ils existent
  - même mois N-1 + croissance historique bornée quand l'objectif mensuel manque
  - objectif annuel réaliste quand il existe, sinon croissance historique bornée
- scénario alcool:
  - uplift ticket moyen par défaut: `+47%`
  - l'uplift ne s'applique pas à tout le CA, seulement à la part caisse estimée
  - effet CA total estimé: `alcool_uplift_pct * caisse_share_pct`
  - mois d'effet par défaut: mois suivant le mois affiché
- la page `/reporting` affiche:
  - trajectoire annuelle sans alcool vs avec alcool
  - impact annuel
  - six prochains mois avec source du calcul

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
- `tests/sales-workbook-parser.test.ts`
- `tests/pos-journal-parser.test.ts`
- `tests/cash-journal-balance.test.ts`
- `tests/middleware.test.ts` — teste le middleware Supabase avec mocks `@supabase/ssr` (chemin legacy supprimé)
- `tests/analytics.test.ts` — inclut test de cohérence dashboard/semaine/reporting
- `tests/api-auth.test.ts` — teste les 403/200 des routes API admin vs manager

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
- Le seed initial des données se fait via `scripts/seed-demo-data.mjs` — `ensureSeedData` a été retiré de `supabase-store.ts`. Ne jamais réintroduire le seed automatique au runtime.
- Les changements reporting/projection doivent maintenir le contrat Zod dans `lib/contracts.ts` pour éviter que le front ne masque silencieusement des champs absents.

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
- `buildCaisseBalance` calcule : `Σ(cash_sales_reference) + Σ(cash_movements_reference) - Σ(expenses)` — intentionnellement cash only.
- `sanitizeParsedRows` dans `app/api/import-csv/route.ts` doit inclure `ca_b2b` — sans ça les paiements CB sont perdus au commit.
- La page import est mobile-first : sélecteurs de navigation centrés via `self-center sm:self-auto`.

## Scripts

- `scripts/bootstrap-auth.mjs` — crée/met à jour les comptes admin et manager dans Supabase. Refuse les variables manquantes, mots de passe par défaut (`alaska2026`, `manager2026`), mots de passe < 12 chars, et admin = manager même email.
- `scripts/seed-demo-data.mjs` — insère les données de démonstration historiques (2025-2026). À lancer une seule fois sur un projet vierge.
- `scripts/validate-v1-staging.mjs` — 8 checks admin/manager sur une URL Vercel cible. Lire le README pour les variables requises.
- `scripts/seed-from-excel.mjs` — import données depuis Excel (usage ponctuel).

## Maintenance Note

Ce fichier a été mis à jour le 2026-04-14 pour refléter la V1 interne validée : bouclage sécurité bootstrap, import CSV depuis contenu brut, suppression mocks runtime, archivage Storage, script de validation staging.

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

## Codex Update — 2026-04-13

Mise à jour réalisée par **Codex**.

Ce que j'ai fait :

- j'ai installé le CLI Supabase localement dans le projet avec `supabase@2.90.0` en `devDependencies`
- le CLI s'utilise avec `npx supabase ...` (`npx supabase --version` retourne `2.90.0`)
- j'ai renommé l'entrée menu `/saisie` de `Saisie` vers `Caisse`
- j'ai mis `Cash théorique enveloppe` en première lecture dans les vues semaine
- j'ai corrigé le calcul semaine pour que les cartes KPI lisent les mêmes `entries` que la grille éditable
- j'ai corrigé le format du libellé `Depuis lun. JJ/MM` dans l'enveloppe cash cumulée
- j'ai corrigé le bug manager où les achats ne remontaient pas quand ils avaient été créés par un autre compte : les routes opérationnelles `daily-entry`, `week` et `caisse/balance` vérifient toujours la session et le rôle via `profiles`, puis lisent/sauvent côté serveur via `createAdminClient()` pour éviter le filtrage RLS `created_by`
- j'ai validé les changements avec `npm.cmd run lint`, `npx tsc --noEmit`, `npm test` et `npm run build`

Notes :

- `SUPABASE_SERVICE_ROLE_KEY` est maintenant nécessaire aux routes opérationnelles qui doivent agréger les données complètes pour les managers.
- `npx supabase --help` fonctionne, mais affiche un warning Docker local : `C:\Users\OthmanBEKRI\.docker\config.json: Access is denied`.
- `npm audit --omit=dev` signale encore des vulnérabilités de production existantes sur `next@14.2.15` et `xlsx`; elles ne viennent pas de l'ajout du CLI Supabase.

## Codex Update — 2026-04-13 bis

Mise à jour réalisée par **Codex**.

Ce que j'ai fait :

- j'ai corrigé la production après le dernier push: `SUPABASE_SERVICE_ROLE_KEY` manquait dans Vercel Production alors que plusieurs routes utilisent désormais `createAdminClient()`
- j'ai redéployé Vercel Production après ajout de la variable et vérifié que les routes Caisse/Saisie ne tombent plus en `500`
- j'ai durci les hooks `useDailyEntry`, `useWeekEntries` et `useCharges` pour ne plus convertir une erreur API en données vides ou zéro silencieux
- j'ai ajouté des logs serveur explicites dans `daily-entry`, `week` et `caisse/balance`
- j'ai rendu `/api/pos-sync` compatible avec les réponses POS CSV ou Excel (`.xls/.xlsx`) et ajouté `lib/sales-workbook-parser.ts`
- j'ai ajouté un test Excel ventes POS dans `tests/sales-workbook-parser.test.ts`
- j'ai remplacé le KPI dashboard "Aujourd'hui" par "Rythme mensuel" avec projection, écart cible et CA/jour restant
- j'ai refondu `/reporting` pour éviter une lecture faussement comptable: focus ventes POS, cash suivi, qualité consolidation, jours forts/faibles, consolidation externe
- j'ai ajouté `smartProjection` dans le reporting: scénario sans alcool vs avec alcool, hypothèses, trajectoire annuelle et six prochains mois
- j'ai validé les changements avec `npx tsc --noEmit`, `npm test`, `npm.cmd run lint` et `npm run build`

Notes :

- plusieurs changements ont été déployés en production via Vercel, mais ils doivent encore être commit/push dans Git si ce n'est pas déjà fait
- le reporting reste volontairement "cash/POS first" jusqu'à l'ajout d'un import de PDF bancaire ou fournisseur pour consolider les virements et charges hors caisse
