# Alaska Pilot — Audit V1 Lancement

> Date d'audit : 2026-04-10
> Portée : état réel du dépôt vs promesse V1 dans `specs/` et `docs/superpowers/`
> Objectif : distinguer ce qui est déjà solide, ce qui reste partiel, ce qui manque pour un V1 lançable, et lister tout ce qui doit être corrigé

---

## Méthode de vérification

Les vérifications suivantes ont été relues ou exécutées :

- lecture des specs métier dans `specs/00-OVERVIEW.md` à `specs/08-DATA-MODEL.md`
- lecture des pages, hooks, API routes, couche analytics, auth, migrations et scripts
- exécution de `npm test`
- exécution de `npm.cmd run lint`
- exécution de `npm run build`

Résultat :

- tests : OK
- lint : OK
- build production : OK

Cela valide que la base technique compile et que les tests actuels passent, mais ne suffit pas à garantir que le produit est prêt pour un vrai lancement V1.

---

## 1. Production-ready

### 1.1 Base technique Next.js / TypeScript / build

- Le dépôt est structuré proprement autour de Next.js App Router avec routes, pages protégées, composants, hooks et couche serveur.
- La compilation et le build passent.
- Références :
  - `package.json`
  - `app/(dashboard)/layout.tsx`
  - `app/layout.tsx`
  - `next.config.mjs`

### 1.2 Couche de calcul métier centralisée

- Les calculs principaux sont bien regroupés dans une couche partagée, ce qui réduit les divergences entre écrans.
- Les KPIs mensuels, vues semaine, reporting et export s'appuient sur la même logique.
- Références :
  - `lib/calculations.ts`
  - `lib/server/analytics.ts`

### 1.3 Flux principaux déjà utilisables pour un pilote interne

- Dashboard lisible avec KPIs, évolution 12 mois et priorités.
- Saisie quotidienne fonctionnelle avec autosave.
- Vue semaine utilisable en mobile et desktop.
- Import CSV avec preview, détection de doublons et commit.
- Reporting mensuel avec export CSV.
- Références :
  - `app/(dashboard)/page.tsx`
  - `app/(dashboard)/saisie/page.tsx`
  - `app/(dashboard)/semaine/page.tsx`
  - `app/(dashboard)/import/page.tsx`
  - `app/(dashboard)/reporting/page.tsx`
  - `app/api/daily-entry/route.ts`
  - `app/api/week/route.ts`
  - `app/api/import-csv/route.ts`
  - `app/api/reporting/route.ts`
  - `app/api/reporting/export/route.ts`

### 1.4 Interface mobile-first déjà crédible

- L'UI est cohérente, claire et suffisamment aboutie pour un usage interne.
- Le shell d'application, la navigation et la page de login sont déjà au niveau d'un pilote sérieux.
- Références :
  - `components/layout/AppShell.tsx`
  - `app/(auth)/login/page.tsx`
  - `app/globals.css`

### 1.5 Base de tests utile, même si encore incomplète

- Les tests couvrent déjà certains calculs critiques, le parser CSV, une partie des règles de merge et le middleware legacy.
- Références :
  - `tests/calculations.test.ts`
  - `tests/csv-parser.test.ts`
  - `tests/pilot-store.test.ts`
  - `tests/middleware.test.ts`
  - `tests/analytics.test.ts`

---

## 2. Prototype / partial

### 2.1 Dashboard incomplet par rapport à la spec

- Le dashboard actuel est utile mais n'implémente pas toute la promesse de `specs/02-DASHBOARD.md`.
- Il manque notamment :
  - la carte "Aujourd'hui"
  - le graphique CA par semaine du mois courant
  - le vrai bloc de progression vs objectifs mensuels
  - le modal de détail d'action
  - le comportement complet "aucune donnée"
- Références :
  - `specs/02-DASHBOARD.md`
  - `app/(dashboard)/page.tsx`
  - `app/api/dashboard/route.ts`

### 2.2 Charges fixes encore au stade MVP simplifié

- Le module permet de lister, modifier un montant, désactiver et créer une charge.
- En revanche il manque :
  - date d'effet
  - historique `charge_history`
  - vraie logique de fin de contrat
  - simulation persistable
  - alertes métier après changement
  - export dédié
- Références :
  - `specs/04-CHARGES.md`
  - `app/(dashboard)/charges/page.tsx`
  - `app/api/charges/route.ts`
  - `lib/hooks/useCharges.ts`
  - `lib/server/supabase-store.ts`

### 2.3 Objectifs et plan d'action surtout en lecture

- La page est visuellement avancée, mais le back-office stratégique reste partiel.
- Fonctionne aujourd'hui :
  - consultation des objectifs
  - consultation des actions
  - changement simple de statut
  - cas spécial "licence alcool"
- Manque encore :
  - édition des objectifs annuels
  - édition des objectifs mensuels
  - création / suppression / modification d'actions
  - vraie trajectoire paramétrable
- Références :
  - `specs/06-OBJECTIFS.md`
  - `app/(dashboard)/objectifs/page.tsx`
  - `app/api/objectives/route.ts`
  - `app/api/objectives/alcool-validate/route.ts`
  - `lib/hooks/useObjectives.ts`

### 2.4 Reporting partiel

- Le module actuel couvre seulement une partie de la spec reporting.
- Existe aujourd'hui :
  - rapport mensuel simplifié
  - export CSV mensuel
- Manque encore :
  - PDF
  - rapport annuel
  - comparaison N vs N-1
  - rapport charges théoriques vs dépenses saisies
  - analyse dédiée service du soir
- Références :
  - `specs/07-REPORTING.md`
  - `app/(dashboard)/reporting/page.tsx`
  - `app/api/reporting/route.ts`
  - `app/api/reporting/export/route.ts`

### 2.5 Import CSV correct pour le pilote, insuffisant pour audit / exploitation robuste

- Le flux preview puis confirmation est propre.
- Mais il manque encore :
  - stockage du fichier brut dans Supabase Storage
  - traçabilité `storage_path`
  - gestion explicite de l'encoding Latin-1
  - prise en compte des montants négatifs selon la spec
  - messages d'erreur plus complets
- Références :
  - `specs/03-IMPORT-CSV.md`
  - `app/(dashboard)/import/page.tsx`
  - `app/api/import-csv/route.ts`
  - `lib/csv-parser.ts`

---

## 3. Missing for V1

### 3.1 Un vrai modèle de sécurité Supabase cohérent

- Pour un V1 lançable, il faut que l'auth, le middleware, les rôles et les policies racontent exactement la même chose.
- Aujourd'hui ce n'est pas encore le cas.
- Solution retenue : créer une table `profiles` (id, role) liée à `auth.users`, protégée par RLS, et lire le rôle côté serveur depuis cette table plutôt que depuis `user_metadata`. Cela évite qu'un utilisateur puisse s'auto-promouvoir côté client. Le middleware et les API routes doivent lire le rôle via `profiles`, pas via le JWT.
- Références :
  - `lib/supabase/middleware.ts`
  - `app/(dashboard)/layout.tsx`
  - `supabase/migrations/20260407180000_init.sql`
  - `specs/01-AUTH.md`

### 3.2 Un schéma SQL aligné avec le code réellement utilisé

- Le champ `mouvement_caisse` est utilisé dans le front, la persistence et les calculs, mais absent de la migration initiale.
- Le champ `charge_history` est annoncé dans `specs/08-DATA-MODEL.md` mais la table correspondante n'existe pas dans la migration.
- Ces deux absences empêchent de dire que le schéma est réellement stabilisé.
- Décision : `mouvement_caisse` reste un champ à part entière dans `daily_sales` — il représente le cash sorti de caisse (virement ou autre mouvement physique) et est intentionnellement séparé des dépenses catégorisées.
- Références :
  - `app/(dashboard)/saisie/page.tsx`
  - `lib/server/supabase-store.ts`
  - `lib/server/analytics.ts`
  - `supabase/migrations/20260407180000_init.sql`
  - `specs/08-DATA-MODEL.md`

### 3.3 Un démarrage de prod explicite, pas un seed implicite au premier accès

- La logique actuelle peut injecter des données mock/synthétiques en base lors d'un simple accès API si certaines tables sont vides.
- Pour une mise en production, ce comportement doit être remplacé par un bootstrap volontaire et traçable.
- Références :
  - `lib/server/supabase-store.ts`
  - `app/api/dashboard/route.ts`
  - `app/api/week/route.ts`
  - `app/api/reporting/route.ts`

### 3.4 Une base de données réelle et portable pour les données historiques

- Le script `seed-from-excel.mjs` dépend d'un chemin local personnel et du package `xlsx`, qui n'est pas déclaré dans `package.json`.
- Ce n'est pas un setup V1 portable pour une autre machine ou un autre développeur.
- Références :
  - `scripts/seed-from-excel.mjs`
  - `package.json`

### 3.5 Des tests d'intégration réels

- Il manque des tests orientés usage réel :
  - auth Supabase
  - middleware réel
  - RLS
  - permissions manager/admin
  - routes API avec base Supabase
- Références :
  - `tests/`

### 3.6 Une documentation d'exploitation minimale

- Le `README.md` est quasi vide.
- Il manque un guide simple :
  - installation
  - env vars
  - bootstrap auth
  - seed de données
  - lancement local
  - checklist avant déploiement
- Références :
  - `README.md`
  - `.env.example`
  - `scripts/bootstrap-auth.mjs`

---

## 4. Technical inconsistencies

### 4.1 Le dashboard `/` n'est pas réellement admin-only

- La spec dit que le manager ne doit pas accéder au dashboard principal.
- Or les routes admin dans le middleware sont limitées à `/charges`, `/objectifs`, `/import`, `/reporting`.
- La racine `/` n'est pas traitée comme route admin.
- Conséquence : le manager peut potentiellement atteindre le dashboard si la session est valide.
- Références :
  - `specs/00-OVERVIEW.md`
  - `specs/01-AUTH.md`
  - `lib/supabase/middleware.ts`
  - `app/(dashboard)/layout.tsx`

### 4.2 Le dépôt garde encore deux systèmes d'auth en parallèle

- L'app fonctionne côté UI avec Supabase Auth.
- Mais le dépôt contient encore :
  - des API routes legacy `api/auth/*`
  - un cookie `alaska_session`
  - un store JSON local avec mots de passe hashés
- Cela crée de la confusion d'architecture et du risque de maintenance.
- C'est l'item le plus urgent à nettoyer, avant même les fonctionnalités manquantes : tant que les deux systèmes coexistent, toute modification de l'auth peut réactiver silencieusement le mauvais chemin.
- Action : supprimer `app/api/auth/*`, `lib/server/auth.ts`, et l'usage de `alaska_session`. Ne conserver que le flux Supabase.
- Références :
  - `app/api/auth/login/route.ts`
  - `app/api/auth/logout/route.ts`
  - `app/api/auth/session/route.ts`
  - `lib/server/auth.ts`
  - `lib/server/pilot-store.ts`
  - `lib/supabase/middleware.ts`

### 4.3 Incohérence entre docs "Supabase source of truth" et dépendance encore active aux mocks

- Plusieurs écrans client utilisent encore `FIXED_CHARGES` depuis `lib/mock-data.ts` au lieu des données live.
- Les créations/désactivations de charges ne se reflètent donc pas partout.
- Références :
  - `CLAUDE.md`
  - `app/(dashboard)/saisie/page.tsx`
  - `components/saisie/WeekGrid.tsx`
  - `lib/mock-data.ts`

### 4.4 Incohérence entre modèle SQL et code sur `monthly_objectives` / `charge_history`

- La doc data model annonce un système complet.
- La migration n'active pas RLS partout et le code n'utilise pas `charge_history`.
- Références :
  - `specs/08-DATA-MODEL.md`
  - `supabase/migrations/20260407180000_init.sql`
  - `app/(dashboard)/charges/page.tsx`
  - `lib/server/supabase-store.ts`

### 4.5 Le reporting et le cash management doivent séparer strictement analytique et trésorerie

- Le produit utilise à la fois :
  - `mouvement_caisse` : mouvement physique de cash (ex : virement depuis le tiroir vers la banque)
  - une dépense catégorie `CHARGES` avec label `"Virement banque"` : enregistrement comptable de ce même mouvement
- Décision retenue : ces deux champs coexistent et remplissent des rôles différents.
  - `mouvement_caisse` alimente uniquement `buildCaisseBalance` (solde physique du tiroir)
  - la dépense `Virement banque` alimente le reporting analytique et les charges
  - il ne doit jamais y avoir de double comptage : si un virement banque est saisi, il doit apparaître soit comme `mouvement_caisse` soit comme dépense selon le contexte d'usage — pas les deux à la fois dans le même calcul
- Action : documenter explicitement dans `CLAUDE.md` et dans `analytics.ts` quels champs alimentent quels calculs, et ajouter un test qui vérifie l'absence de double comptage.
- Références :
  - `app/(dashboard)/saisie/page.tsx`
  - `lib/server/analytics.ts`
  - `CLAUDE.md`

### 4.6 Les tests middleware couvrent surtout le chemin legacy

- Les tests passent, mais ils utilisent le cookie `alaska_session` et non un vrai flux Supabase.
- Cela peut masquer des écarts sur le comportement réel en production.
- Références :
  - `tests/middleware.test.ts`
  - `lib/supabase/middleware.ts`

### 4.7 Fallbacks silencieux qui masquent les pannes

- Certaines routes ou couches serveur retombent sur des tableaux vides ou des données dégradées.
- Cela évite un crash, mais peut aussi masquer une panne réelle de permissions ou de schéma.
- Références :
  - `lib/server/supabase-store.ts`
  - `app/api/objectives/route.ts`

---

## 5. Product / UX / data risks

### 5.1 Risque sécurité : rôle basé sur `user_metadata`

- Les policies utilisent `auth.jwt() -> 'user_metadata' ->> 'role'`.
- C'est une zone sensible et fragile : `user_metadata` est modifiable par le client via l'API Supabase Auth sans nécessiter de droits admin.
- Un utilisateur malveillant pourrait s'auto-attribuer le rôle `admin` côté client si les policies ne sont pas doublées d'une vérification serveur.
- Solution : remplacer par une table `profiles` avec RLS strict (voir §3.1) et mettre à jour les policies pour lire depuis `profiles` via `auth.uid()`.
- Références :
  - `supabase/migrations/20260407180000_init.sql`
  - `scripts/bootstrap-auth.mjs`

### 5.2 Risque manager : droits réels pas totalement alignés avec la promesse produit

- Le manager est censé saisir et consulter.
- Mais les policies actuelles ne sont pas manifestement alignées avec toutes les mutations nécessaires de `daily_sales`.
- Références :
  - `specs/01-AUTH.md`
  - `app/api/daily-entry/route.ts`
  - `supabase/migrations/20260407180000_init.sql`

### 5.3 Risque data : injection automatique de données mock ou synthétiques

- Le seed automatique au premier usage peut mélanger :
  - données mock
  - historiques reconstruits artificiellement
  - vraies données importées ensuite
- Cela peut fausser les indicateurs si le bootstrap n'est pas maîtrisé.
- Références :
  - `lib/server/supabase-store.ts`
  - `lib/mock-data.ts`

### 5.4 Risque reporting : lecture financière partiellement incomplète

- Le reporting affiche une vue mensuelle utile mais pas encore un rapport financier complet tel qu'attendu par la spec.
- Risque : sur-promesse produit vis-à-vis du besoin comptable ou stratégique.
- Références :
  - `specs/07-REPORTING.md`
  - `app/(dashboard)/reporting/page.tsx`

### 5.5 Risque import : absence d'archive brute

- Sans fichier CSV brut stocké, il n'y a pas de vraie piste d'audit.
- Références :
  - `specs/03-IMPORT-CSV.md`
  - `app/api/import-csv/route.ts`

### 5.6 Risque UX : certains écrans semblent plus complets qu'ils ne le sont vraiment

- Visuellement, objectifs, charges et reporting donnent une impression de produit fini.
- En réalité, plusieurs actions CRUD ou analyses métier avancées ne sont pas encore implémentées.
- Cela peut créer un écart entre perception et capacité réelle.
- Références :
  - `app/(dashboard)/charges/page.tsx`
  - `app/(dashboard)/objectifs/page.tsx`
  - `app/(dashboard)/reporting/page.tsx`

### 5.7 Risque exploitation : documentation quasi absente

- En l'état, le projet dépend encore beaucoup de contexte tacite.
- Références :
  - `README.md`
  - `CLAUDE.md`

---

## 6. Backlog complet de correction

## 6.1 Priorité P0 — bloquants avant vrai lancement V1

- Supprimer l'ancien système d'auth local en premier :
  - retirer `app/api/auth/*`, `lib/server/auth.ts`, le cookie `alaska_session`
  - ne conserver que le flux Supabase Auth
  - fichiers : `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`, `app/api/auth/session/route.ts`, `lib/server/auth.ts`, `lib/server/pilot-store.ts`

- Migrer les rôles de `user_metadata` vers une table `profiles` :
  - créer la table `profiles (id uuid references auth.users, role text)`
  - ajouter RLS : seul le service role peut écrire, l'utilisateur peut lire sa propre ligne
  - mettre à jour les policies Supabase pour lire depuis `profiles`
  - mettre à jour `bootstrap-auth.mjs` pour insérer dans `profiles` à la création des comptes
  - mettre à jour le middleware et les API routes pour lire le rôle depuis `profiles`
  - fichiers : `scripts/bootstrap-auth.mjs`, `supabase/migrations/20260407180000_init.sql`, `lib/supabase/middleware.ts`, `app/api/*`

- Corriger la stratégie d'autorisation :
  - rendre `/` strictement admin-only dans le middleware
  - vérifier les accès API côté serveur pour chaque route sensible
  - aligner middleware, layout et policies
  - fichiers : `lib/supabase/middleware.ts`, `app/(dashboard)/layout.tsx`, `app/api/*`, `supabase/migrations/20260407180000_init.sql`

- Ajouter une migration pour réaligner le schéma avec le code :
  - ajouter `mouvement_caisse` dans `daily_sales`
  - ajouter la table `charge_history`
  - ajouter la table `profiles`
  - vérifier toutes les colonnes réellement utilisées
  - activer RLS sur les tables oubliées
  - fichiers : `supabase/migrations/` (nouvelle migration)

- Supprimer le seed automatique au runtime :
  - rendre le bootstrap explicite
  - éviter l'injection automatique de données mock en prod
  - fichiers : `lib/server/supabase-store.ts`, `app/api/dashboard/route.ts`, `app/api/week/route.ts`, `app/api/reporting/route.ts`

- Documenter et tester la séparation `mouvement_caisse` / dépense `Virement banque` :
  - clarifier dans `CLAUDE.md` et dans les commentaires `analytics.ts` quels champs alimentent quels calculs
  - ajouter un test unitaire vérifiant l'absence de double comptage
  - fichiers : `app/(dashboard)/saisie/page.tsx`, `lib/server/analytics.ts`, `CLAUDE.md`, `tests/analytics.test.ts`

## 6.2 Priorité P1 — nécessaire pour un V1 crédible et maintenable

- Supprimer ou isoler définitivement l'ancienne auth locale :
  - retirer `api/auth/*` si inutile
  - retirer `lib/server/auth.ts` si inutile
  - retirer la dépendance au JSON local comme source d'auth
  - fichiers : `app/api/auth/*`, `lib/server/auth.ts`, `lib/server/pilot-store.ts`

- Brancher tous les écrans runtime sur la vraie base :
  - remplacer l'usage de `FIXED_CHARGES` mock dans la saisie et la semaine
  - fichiers : `app/(dashboard)/saisie/page.tsx`, `components/saisie/WeekGrid.tsx`, `lib/mock-data.ts`

- Compléter le module charges :
  - date d'effet
  - désactivation avec fin réelle
  - historique `charge_history`
  - simulation appliquable
  - fichiers : `app/(dashboard)/charges/page.tsx`, `app/api/charges/route.ts`, `lib/server/supabase-store.ts`

- Compléter le module objectifs :
  - édition objectif annuel
  - édition objectifs mensuels
  - création / suppression / modification d'actions
  - fichiers : `app/(dashboard)/objectifs/page.tsx`, `app/api/objectives/route.ts`, `lib/hooks/useObjectives.ts`

- Compléter le reporting V1 :
  - rapport mensuel plus complet
  - comparatif N vs N-1
  - réconciliation charges théoriques vs saisies
  - export plus riche
  - fichiers : `app/(dashboard)/reporting/page.tsx`, `app/api/reporting/route.ts`, `app/api/reporting/export/route.ts`

- Rendre l'import plus robuste :
  - stockage du CSV brut
  - gestion `storage_path`
  - meilleure validation d'encodage
  - meilleure gestion erreurs / remboursements
  - fichiers : `app/api/import-csv/route.ts`, `lib/csv-parser.ts`

## 6.3 Priorité P2 — qualité, fiabilité, industrialisation

- Ajouter des tests d'intégration Supabase :
  - login
  - rôle manager
  - rôle admin
  - daily entry
  - import CSV
  - reporting
  - fichiers : `tests/`

- Ajouter des tests d'autorisation :
  - dashboard inaccessible au manager
  - routes admin interdites au manager
  - mutations interdites hors rôle
  - fichiers : `tests/`, `lib/supabase/middleware.ts`

- Rendre les scripts d'import portables :
  - enlever les chemins locaux personnels
  - déclarer les dépendances manquantes
  - documenter l'usage
  - fichiers : `scripts/seed-from-excel.mjs`, `scripts/import-pos-csv.mjs`, `package.json`

- Éviter les fallbacks silencieux non contrôlés :
  - mieux remonter les erreurs
  - différencier mode dev et mode prod
  - fichiers : `lib/server/supabase-store.ts`, `app/api/objectives/route.ts`

- Documenter l'exploitation :
  - setup local
  - env vars
  - seed
  - bootstrap auth
  - déploiement
  - checklist release
  - fichiers : `README.md`, `.env.example`

## 6.4 Priorité P3 — amélioration produit après V1

- Enrichir le dashboard selon la spec complète
- Ajouter PDF reporting
- Ajouter analyse service du soir dédiée
- Ajouter PWA / offline si le besoin se confirme
- Ajouter cache, skeletons et raffinements performance annoncés dans les specs
- Références :
  - `specs/02-DASHBOARD.md`
  - `specs/07-REPORTING.md`
  - `specs/00-OVERVIEW.md`

---

## 7. Synthèse courte

L'application est déjà suffisamment avancée pour un pilote interne contrôlé, avec une vraie base produit, une UI convaincante et des flux métier centraux opérationnels. En revanche, elle n'est pas encore totalement prête pour un lancement V1 propre et maintenable tant que la sécurité des rôles, l'alignement schéma/code, la suppression des dépendances aux mocks et la finition des modules charges / objectifs / reporting ne sont pas traités.

Le principal enjeu n'est plus "construire la démo", mais stabiliser le socle de vérité : auth, RLS, données, bootstrap, et cohérence métier.
