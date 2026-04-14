# CODEX-BRIEF — Alaska Pilot V1

> Date : 2026-04-14
> Référence spec : `specs/10-SPEC-V1-LANCEMENT.md`
> Objectif : amener le projet à l'état V1 lançable tel que défini dans la spec

---

## Contexte rapide

Alaska Pilot est une webapp Next.js + Supabase de pilotage financier d'un restaurant.
Stack : Next.js 14 App Router, Supabase Auth + PostgreSQL, Vitest, Vercel.

Le socle technique est en place depuis l'audit P0 du 2026-04-10. Ce brief liste
uniquement ce qui reste à faire avant le lancement V1.

---

## Ce qui est déjà fait (ne pas retoucher)

- Auth Supabase réelle avec roles dans `profiles` (migrations appliquées)
- Middleware de protection des routes admin/manager (`middleware.ts`)
- Vérification de rôle côté API via `getUserRole()` et `isAdmin()` dans `lib/supabase/server.ts`
- Toutes les tables principales existent : `profiles`, `daily_sales`, `expenses`,
  `fixed_charges`, `charge_history`, `objectives`, `monthly_objectives`, `action_items`,
  `pos_imports`, `expense_sections`, `expense_item_templates`
- `ensureSeedData` retiré du runtime applicatif
- Routes opérationnelles lisent via `createAdminClient()` pour éviter le filtrage RLS `created_by`
- Parser CSV ventes (`lib/csv-parser.ts`) et Excel (`lib/sales-workbook-parser.ts`)
- Parser journal caisse (`lib/pos-journal-parser.ts`)
- `smartProjection` dans le reporting
- CRUD objectifs et actions
- Tests existants dans `tests/` : calculations, analytics, csv-parser, sales-workbook-parser,
  pos-journal-parser, cash-journal-balance, middleware

---

## Gaps à fermer — par priorité

### P0 — Bloquants pour le lancement

#### 1. Exclure `.worktrees/` de Vitest

**Fichier :** `vitest.config.ts`

La config actuelle n'exclut pas `.worktrees/`. Si ce dossier existe localement,
Vitest peut ramasser des tests parasites.

```ts
// vitest.config.ts — ajouter dans test:
exclude: ["node_modules", ".worktrees/**"],
```

#### 2. Écrire le README d'exploitation

**Fichier :** `README.md` (actuellement vide)

Le README doit contenir exactement les sections listées dans `specs/10-SPEC-V1-LANCEMENT.md §6` :

- Présentation courte du projet
- Prérequis (Node, npm, Supabase CLI)
- Variables d'environnement (référencer `.env.example`)
- Installation
- Migrations Supabase (`npx supabase db push` ou instructions manuelles)
- Bootstrap auth (`node scripts/bootstrap-auth.mjs`)
- Seed données (script explicite à documenter)
- Lancement local (`npm run dev`)
- Tests (`npm test`)
- Build production (`npm run build`)
- Déploiement Vercel (variables d'env à configurer)
- Checklist avant mise en prod
- Procédure de rollback minimale

Le contenu doit permettre à quelqu'un qui n'a jamais vu le projet de le lancer.

#### 3. Tests d'autorisation API

**Dossier :** `tests/`

Aucun test ne vérifie qu'une route API admin retourne `403` pour un manager.
Créer `tests/api-auth.test.ts` avec au minimum :

- `GET /api/dashboard` avec session manager → 403
- `GET /api/charges` avec session manager → 403
- `GET /api/reporting` avec session manager → 403
- `GET /api/objectives` avec session manager → 403
- `GET /api/daily-entry` avec session manager → 200 (autorisé)
- `GET /api/week` avec session manager → 200 (autorisé)

Utiliser le même pattern de mock que `tests/middleware.test.ts`.

---

### P1 — Important pour la qualité data

#### 4. Archivage fichier source dans Supabase Storage

**Contexte :** `pos_imports.storage_path` existe dans le schéma mais est toujours `null`
(voir `lib/server/supabase-store.ts`). Aucune route n'envoie le fichier vers Storage.

**Décision requise avant implémentation :**
- Option A : implémenter l'upload vers Supabase Storage dans `app/api/pos-sync/route.ts`
  et `app/api/import-csv/route.ts`, puis renseigner `storage_path`
- Option B : reporter explicitement avec une note dans la spec

Si Option A : créer le bucket `pos-imports` dans Supabase (politique : private, accès admin only),
uploader le buffer brut avant commit, stocker le path dans `pos_imports`.

#### 5. Écrire `charge_history` à chaque modification de charge

**Fichier :** `app/api/charges/route.ts`

La table `charge_history` existe mais aucune route n'y insère. À chaque `PUT` ou `DELETE`
sur une charge fixe, insérer une ligne dans `charge_history` avec l'ancienne valeur,
la nouvelle valeur et la date.

#### 6. Vérifier cohérence dashboard / semaine / reporting

Sur un jeu de données fixe (ex. mois de mars avec 10 jours importés), vérifier que :
- `ca_total` dashboard = `ca_total` reporting = somme semaines
- `depenses` dashboard = `depenses` reporting

Idéalement sous forme de test dans `tests/analytics.test.ts`.

---

### P2 — Finitions produit

#### 7. États vides explicites

Sur les pages dashboard, reporting et import : si aucune donnée n'existe pour le mois
sélectionné, afficher un message clair. Ne pas afficher 0 sans contexte.

#### 8. Retirer les promesses UI de PDF

Si une mention "Export PDF" ou bouton PDF existe dans l'UI, le retirer ou le désactiver
avec une note "À venir". La spec autorise l'absence de PDF pour un usage interne.

#### 9. Passe mobile sur les 6 pages principales

Pages : `/`, `/saisie`, `/semaine`, `/charges`, `/objectifs`, `/reporting`

Vérifier sur viewport 375px que les formulaires et tableaux sont utilisables.

---

## Commandes de validation

Après chaque tâche, valider avec :

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Le critère de lancement V1 est que ces quatre commandes passent sans erreur.

---

## Fichiers clés à connaître

| Rôle | Fichier |
|------|---------|
| Règles métier | `CLAUDE.md` |
| Spec complète V1 | `specs/10-SPEC-V1-LANCEMENT.md` |
| Logique analytics | `lib/server/analytics.ts` |
| Store Supabase | `lib/server/supabase-store.ts` |
| Calculs partagés | `lib/calculations.ts` |
| Helpers auth côté serveur | `lib/supabase/server.ts` |
| Client admin Supabase | `lib/supabase/admin.ts` |
| Variables d'env requises | `.env.example` |

---

## Règles à ne pas enfreindre

- Ne jamais lire le rôle depuis `user_metadata` — toujours depuis `profiles` via `getUserRole()`
- Ne jamais préfixer `SUPABASE_SERVICE_ROLE_KEY` par `NEXT_PUBLIC_`
- Ne jamais réintroduire de seed automatique dans les routes API
- `ca_total = ca_caisse + ca_b2b` pour tous les KPIs — `ca_caisse` seul uniquement pour le solde caisse physique
- `mouvement_caisse` et dépense `"Virement banque"` ne doivent jamais être additionnés dans le même calcul
