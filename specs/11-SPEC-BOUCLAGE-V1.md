# Alaska Pilot — Spec de bouclage V1

> Version : 1.0
> Date : 2026-04-14
> Objectif : fermer les derniers risques techniques, data et produit avant lancement V1 interne
> Statut cible : V1 exploitable par Alaska Neo Bistrot avec admin + manager réels

---

## 1. Résumé exécutif

Le projet est proche d'une V1 lançable : les tests passent, le build passe, l'auth Supabase est en place, les rôles sont lus depuis `profiles`, les routes admin sont protégées, les imports POS peuvent archiver les fichiers sources, et les principaux écrans métier existent.

Le bouclage V1 ne consiste donc pas à ajouter de nouvelles fonctionnalités majeures. Il consiste à fermer les derniers risques :

- sécurité de bootstrap
- vérité et auditabilité des imports
- séparation claire entre données runtime et mocks/seeds
- cohérence des chemins d'import
- validation Supabase réelle avant lancement
- petites dettes UX/data sur charges et objectifs

Cette spec complète `specs/10-SPEC-V1-LANCEMENT.md` et transforme l'audit actuel en plan de fermeture.

---

## 2. État actuel validé

### 2.1 Validations locales

Les commandes suivantes doivent rester vertes pendant tout le bouclage :

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

État vérifié le 2026-04-14 :

- `npm test` : OK, 8 fichiers, 30 tests.
- `npm run lint` : OK.
- `npx tsc --noEmit` : OK.
- `npm run build` : OK.

Fichiers concernés :

- `package.json`
- `vitest.config.ts`
- `tests/*`

### 2.2 Socle considéré stable

Ne pas refondre sans nécessité :

- Auth Supabase email/password.
- Rôles `admin` et `manager` dans `public.profiles`.
- Middleware route admin/manager.
- Vérification serveur des API admin.
- Parser ventes POS CSV/Excel.
- Parser journal caisse.
- Dashboard, saisie, semaine, import, charges, objectifs, reporting.
- Calculs centralisés dans `lib/server/analytics.ts`.

Fichiers clés :

- `lib/supabase/middleware.ts`
- `lib/supabase/server.ts`
- `lib/supabase/admin.ts`
- `lib/server/analytics.ts`
- `lib/server/supabase-store.ts`
- `app/api/*`
- `app/(dashboard)/*`

---

## 3. Objectif de bouclage

La V1 est considérée bouclée quand :

1. Aucun identifiant par défaut ne peut être utilisé en production.
2. Aucun import V1 ne peut créer des données sans trace d'audit.
3. Les données runtime ne dépendent plus de mocks ou de seeds implicites.
4. Les chemins d'import API et CLI racontent la même histoire data.
5. Un test ou script de validation Supabase réelle confirme les accès admin/manager.
6. Le README reste aligné avec le comportement réel.
7. Les validations locales passent.
8. Le parcours réel admin et manager est testé sur l'environnement cible.

---

## 4. P0 — Bloquants avant lancement

### 4.1 Durcir le bootstrap auth

#### Problème

`scripts/bootstrap-auth.mjs` retombe encore sur des emails et mots de passe par défaut si les variables d'environnement ne sont pas définies.

Référence :

- `scripts/bootstrap-auth.mjs`

#### Décision V1

Le bootstrap doit refuser tout lancement si une variable requise manque :

- `ALASKA_ADMIN_EMAIL`
- `ALASKA_ADMIN_PASSWORD`
- `ALASKA_MANAGER_EMAIL`
- `ALASKA_MANAGER_PASSWORD`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Le script doit aussi refuser explicitement :

- `alaska2026`
- `manager2026`
- tout mot de passe de moins de 12 caractères
- admin et manager avec le même email

#### Critères d'acceptation

- Sans les 4 variables `ALASKA_*`, le script échoue avec un message clair.
- Avec un mot de passe par défaut, le script échoue.
- Avec deux comptes valides, le script crée ou met à jour les utilisateurs et écrit les rôles dans `profiles`.
- Le README ne mentionne aucun fallback implicite.

#### Tests

- Ajouter un test unitaire léger si le script est factorisé.
- Sinon vérifier manuellement avec un `.env.local` incomplet.

---

### 4.2 Durcir l'import CSV manuel

#### Problème

La route `app/api/import-csv/route.ts` accepte actuellement des lignes `parsed` envoyées par le client. Pour une V1 auditée, le commit doit dépendre du fichier brut, pas de la représentation client.

Référence :

- `app/api/import-csv/route.ts`
- `app/(dashboard)/import/page.tsx`
- `lib/csv-parser.ts`
- `lib/server/import-storage.ts`

#### Décision V1

Au moment du commit :

1. Le client envoie `filename`, `content`, `commit: true`.
2. Le serveur parse `content` avec `parseCSV(content)`.
3. Le serveur archive `content` dans Supabase Storage.
4. Le serveur écrit `pos_imports.storage_path`.
5. Le serveur upsert `daily_sales`.
6. Le serveur renvoie le résultat final.

Les lignes `parsed` peuvent rester utilisées pour la preview, mais ne doivent pas être la source de vérité du commit.

#### Critères d'acceptation

- Un commit sans `content` retourne `400`.
- Un commit avec `parsed` modifié côté client n'altère pas les données si `content` ne correspond pas.
- Chaque import validé possède un `storage_path` non nul.
- Le fichier brut est stocké dans le bucket `pos-imports`.
- Les doublons restent visibles avant commit.

#### Tests

- Ajouter un test route ou un test helper qui vérifie que le commit repars du contenu brut.
- Ajouter un cas de CSV invalide qui échoue avant écriture en base.

---

### 4.3 Sortir les mocks du runtime store

#### Problème

`lib/server/supabase-store.ts` importe encore `lib/mock-data.ts` et contient `ensureSeedData`. Même si le runtime ne l'appelle plus, cette proximité crée un risque de réintroduction silencieuse.

Références :

- `lib/server/supabase-store.ts`
- `lib/mock-data.ts`
- `scripts/seed-from-excel.mjs`

#### Décision V1

Le runtime serveur ne doit plus importer `lib/mock-data.ts`.

Options acceptées :

- déplacer `ensureSeedData` dans un script explicite `scripts/seed-demo-data.mjs`
- ou supprimer `ensureSeedData` si elle n'est plus utilisée

#### Critères d'acceptation

- `rg "mock-data" app lib` ne retourne aucun import runtime.
- `lib/server/supabase-store.ts` ne contient plus `ensureSeedData`.
- Les données de démonstration ne sont chargeables que par script explicite.
- Les routes API ne peuvent pas seed la base.

#### Tests

- `npm test`
- `npm run build`
- vérification statique `rg "ensureSeedData|mock-data" app lib`

---

### 4.4 Unifier les chemins d'import POS

#### Problème

Les routes API modernes créent un historique `pos_imports` avec `storage_path`, mais `scripts/import-pos-csv.mjs` upsert directement `daily_sales` sans historique ni archive.

Références :

- `app/api/pos-sync/route.ts`
- `app/api/import-csv/route.ts`
- `scripts/import-pos-csv.mjs`
- `lib/server/import-storage.ts`

#### Décision V1

Choisir une seule option :

Option A — recommandée :

- supprimer ou déprécier `scripts/import-pos-csv.mjs`
- documenter que les imports V1 passent par `/import`

Option B :

- mettre le script au même niveau que l'API :
  - archive Storage
  - insertion `pos_imports`
  - `import_id` dans `daily_sales`
  - préservation des champs journal caisse
  - status `success` / `partial` / `error`

#### Critères d'acceptation

- Aucun chemin documenté ne permet d'importer du POS sans historique.
- Le README indique clairement le chemin recommandé.
- `pos_imports` devient la source d'audit pour tous les imports V1.

---

### 4.5 Validation Supabase réelle

#### Problème

Les tests actuels mockent Supabase. Ils valident le comportement attendu du code, mais pas les policies RLS ni la configuration réelle du projet.

Références :

- `tests/api-auth.test.ts`
- `tests/middleware.test.ts`
- `supabase/migrations/*`
- `README.md`

#### Décision V1

Ajouter une procédure de validation Supabase réelle, sous forme d'un script ou d'une checklist exécutable.

Le minimum V1 :

1. Appliquer les migrations sur un projet Supabase de staging.
2. Lancer `scripts/bootstrap-auth.mjs`.
3. Tester login admin.
4. Tester login manager.
5. Vérifier que manager accède à `/saisie` et `/semaine`.
6. Vérifier que manager reçoit `403` sur les API admin.
7. Vérifier qu'un import POS crée `pos_imports.storage_path`.
8. Vérifier qu'une saisie manager persiste après refresh.

#### Critères d'acceptation

- Une personne autre que le développeur principal peut suivre la procédure.
- Les résultats attendus sont documentés dans `README.md` ou `docs/`.
- La checklist est exécutée avant déploiement production.

---

## 5. P1 — Qualité produit et data

### 5.1 Finaliser les dates d'effet des charges

#### Problème

Le modèle contient `start_date`, `end_date` et `charge_history`, mais l'UI charges ne permet pas encore de piloter proprement une date d'effet ou une fin de charge.

Références :

- `app/(dashboard)/charges/page.tsx`
- `app/api/charges/route.ts`
- `lib/server/supabase-store.ts`
- `supabase/migrations/20260407180000_init.sql`

#### Décision V1

Pour une charge fixe, l'admin doit pouvoir :

- modifier le montant
- définir une date d'effet
- désactiver avec une date de fin
- consulter au moins la dernière modification ou voir que l'historique existe

#### Critères d'acceptation

- Une désactivation renseigne `end_date`.
- Le seuil du mois courant ignore les charges terminées avant le mois.
- Chaque changement écrit `charge_history`.
- Le message UI confirme la modification ou affiche l'erreur.

---

### 5.2 Clarifier le statut des objectifs annuels

#### Problème

Les objectifs mensuels sont éditables, les actions sont CRUD, mais certains chiffres annuels/scénarios restent en dur dans l'interface.

Références :

- `app/(dashboard)/objectifs/page.tsx`
- `app/api/objectives/route.ts`
- `lib/hooks/useObjectives.ts`
- `lib/server/supabase-store.ts`

#### Décision V1

Choisir un comportement clair :

Option A :

- les objectifs annuels sont consultatifs en V1
- l'UI indique qu'ils sont dérivés ou non éditables

Option B :

- ajouter édition admin des objectifs annuels par scénario
- stocker dans `objectives`

#### Critères d'acceptation

- Aucun tableau ne présente des chiffres codés en dur comme s'ils venaient de Supabase.
- Si non éditable, le wording le dit clairement.
- Si éditable, la modification persiste après refresh.

---

### 5.3 Renforcer les erreurs utilisateur

#### Problème

Certains hooks ignorent les erreurs côté UI ou retombent simplement sur `[]`.

Références :

- `lib/hooks/useCharges.ts`
- `lib/hooks/useExpenseTemplates.ts`
- `lib/hooks/useObjectives.ts`
- `lib/hooks/useDashboard.ts`

#### Décision V1

Les écrans admin doivent afficher une erreur lisible quand :

- les charges ne chargent pas
- les modèles de saisie ne chargent pas
- une création/modification échoue
- l'import ou le reporting échoue

#### Critères d'acceptation

- Aucun échec critique ne disparaît silencieusement.
- Les messages sont orientés action : "réessaie", "vérifie les variables POS", "contact admin".
- Les états vides restent distincts des erreurs.

---

### 5.4 Retirer les fallbacks legacy en V1

#### Problème

Des fallbacks existent pour tables manquantes ou données vides. Ils étaient utiles en MVP, mais peuvent masquer une migration non appliquée.

Références :

- `app/api/import-csv/route.ts`
- `lib/server/supabase-store.ts`

#### Décision V1

En production, une table critique manquante doit provoquer une erreur claire, pas un état vide.

Tables critiques :

- `profiles`
- `daily_sales`
- `expenses`
- `fixed_charges`
- `charge_history`
- `objectives`
- `monthly_objectives`
- `action_items`
- `pos_imports`
- `expense_sections`
- `expense_item_templates`

#### Critères d'acceptation

- Les routes retournent `500` avec message d'exploitation si une table critique manque.
- Les fallbacks silencieux sont réservés au développement ou retirés.
- Le README indique d'appliquer les migrations si cette erreur apparaît.

---

## 6. P2 — Finitions avant bascule

### 6.1 Passe mobile réelle

Pages à vérifier sur viewport 375px :

- `/`
- `/saisie`
- `/semaine`
- `/charges`
- `/objectifs`
- `/import`
- `/reporting`

Critères :

- aucun tableau important inutilisable
- boutons visibles
- formulaire saisissable
- aucun texte critique tronqué
- navigation manager/admin claire

### 6.2 Vérification POS bout en bout

Sur l'environnement cible :

1. Configurer :
   - `POS_API_URL`
   - `POS_JOURNAL_API_URL`
   - `POS_CAISSE_ID`
   - `POS_API_TOKEN`
2. Synchroniser ventes POS.
3. Synchroniser journal caisse.
4. Vérifier `pos_imports.storage_path`.
5. Vérifier dashboard.
6. Vérifier reporting.
7. Vérifier export CSV.

### 6.3 Checklist rollback

Avant lancement :

- identifier le dernier déploiement Vercel stable
- vérifier les backups Supabase disponibles
- documenter la commande ou action de rollback Vercel
- documenter la stratégie si une migration casse la prod

Référence :

- `README.md`

---

## 7. Ordre d'exécution recommandé

### Étape 1 — Sécurité bootstrap

Fichier :

- `scripts/bootstrap-auth.mjs`

Livrable :

- script sans identifiants par défaut
- README aligné

Validation :

```bash
npm test
npm run build
```

### Étape 2 — Import CSV source de vérité

Fichiers :

- `app/api/import-csv/route.ts`
- `app/(dashboard)/import/page.tsx`
- `tests/*`

Livrable :

- commit serveur basé sur `content`
- archive Storage obligatoire
- test du comportement

Validation :

```bash
npm test
npm run build
```

### Étape 3 — Nettoyage mocks runtime

Fichiers :

- `lib/server/supabase-store.ts`
- `lib/mock-data.ts`
- `scripts/*`

Livrable :

- plus aucun import `mock-data` depuis `app` ou `lib/server`
- seed uniquement explicite

Validation :

```bash
rg "mock-data|ensureSeedData" app lib
npm test
npm run build
```

### Étape 4 — Unification imports POS

Fichiers :

- `scripts/import-pos-csv.mjs`
- `app/api/pos-sync/route.ts`
- `app/api/import-csv/route.ts`
- `README.md`

Livrable :

- soit script supprimé/déprécié
- soit script aligné avec `pos_imports` + Storage

Validation :

- import de test
- `pos_imports.storage_path` non nul

### Étape 5 — Validation Supabase staging

Fichiers :

- `README.md`
- éventuellement `docs/V1-STAGING-CHECKLIST.md`
- éventuellement `scripts/validate-v1-staging.mjs`

Livrable :

- checklist réelle exécutée
- preuves minimales : résultats attendus cochés

Validation :

- admin OK
- manager OK
- API admin 403 manager
- import POS OK
- reporting export OK

---

## 8. Critères finaux de lancement

La V1 peut être lancée en interne seulement si tous les points ci-dessous sont vrais :

- `npm test` passe.
- `npm run lint` passe.
- `npx tsc --noEmit` passe.
- `npm run build` passe.
- `scripts/bootstrap-auth.mjs` refuse les defaults.
- Les comptes admin et manager réels existent.
- Les rôles sont dans `public.profiles`.
- Le manager ne voit que `/saisie` et `/semaine`.
- Les API admin retournent `403` pour manager.
- Les imports ventes POS archivent le fichier source.
- Les imports journal caisse archivent le fichier source.
- Aucun chemin documenté n'importe du POS sans `pos_imports`.
- Aucune route API ne seed des mocks.
- Le dashboard, la semaine et le reporting donnent les mêmes totaux sur un mois test.
- Le README permet de réinstaller et relancer le projet.
- Le rollback Vercel/Supabase est documenté.

---

## 9. Non-objectifs du bouclage

Ne pas bloquer la V1 sur :

- PDF reporting automatique.
- PWA.
- Offline.
- notifications.
- multi-restaurant.
- permissions granulaires au-delà de `admin` et `manager`.
- refonte visuelle majeure.
- prédiction avancée.

---

## 10. Definition of done

Le bouclage est terminé quand :

1. Les 5 tâches P0 sont fermées.
2. Les P1 critiques sont soit implémentées, soit explicitement reportées dans cette spec.
3. Les validations locales sont vertes.
4. Une validation Supabase staging a été faite.
5. La checklist V1 finale est cochée dans le README ou dans un document de release.

À ce moment, Alaska Pilot peut passer en V1 interne contrôlée.
