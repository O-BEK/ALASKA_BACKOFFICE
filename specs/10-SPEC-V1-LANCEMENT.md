# Alaska Pilot — Spec de passage en V1

> Version : 1.0
> Date : 2026-04-14
> Objectif : transformer l'application actuelle en V1 lançable, stable et exploitable
> Statut cible : production interne pour Alaska Neo Bistrot

---

## 1. Intention V1

La V1 doit etre un outil fiable de pilotage quotidien du restaurant, pas une demo.

Elle doit permettre a l'admin de suivre le chiffre d'affaires, la caisse, les depenses, les charges, les objectifs et les rapports mensuels avec une confiance suffisante pour prendre des decisions.

Elle doit permettre au manager de saisir les depenses et consulter la semaine sans acceder aux zones admin.

La V1 n'a pas besoin de couvrir toutes les ambitions phase 2 et phase 3, mais elle doit fermer les risques critiques :

- securite des roles
- verite des donnees
- imports auditables
- tests verts
- documentation d'exploitation
- parcours principaux utilisables sans connaissance implicite du code

---

## 2. Perimetre fonctionnel V1

### 2.1 Authentification et roles

#### Doit exister

- Connexion email/password via Supabase Auth.
- Deux roles applicatifs :
  - `admin`
  - `manager`
- Les roles sont stockes dans `public.profiles`.
- Le role ne doit jamais etre lu depuis `user_metadata` pour une decision de securite.
- Un manager doit etre redirige vers `/saisie`.
- Un manager ne doit pas acceder a :
  - `/`
  - `/charges`
  - `/objectifs`
  - `/import`
  - `/reporting`
- Les API admin doivent refaire la verification de role cote serveur.

#### Fichiers concernes

- `lib/supabase/middleware.ts`
- `lib/supabase/server.ts`
- `app/(dashboard)/layout.tsx`
- `components/layout/AppShell.tsx`
- `supabase/migrations/20260410000000_p0_profiles_schema_fixes.sql`
- `supabase/migrations/20260412110000_harden_profile_bootstrap.sql`
- `scripts/bootstrap-auth.mjs`

#### Criteres d'acceptation

- Un utilisateur non connecte est redirige vers `/login`.
- Un admin accede a toutes les pages.
- Un manager accede seulement a `/saisie` et `/semaine`.
- Les tests middleware couvrent ces cas.
- Les policies Supabase ne dependent pas de `user_metadata`.

---

### 2.2 Dashboard admin

#### Doit exister

- Vue mensuelle du CA total.
- Separation CA caisse / CA B2B.
- Suivi du seuil de rentabilite.
- Suivi objectif mensuel.
- Indicateur du jour courant.
- Evolution des derniers mois.
- Signal qualite data : mois vide, jours manquants, anomalies caisse.

#### Hors V1

- Alertes automatiques avancees.
- Notifications.
- Prediction complexe multi-scenarios.

#### Fichiers concernes

- `app/(dashboard)/page.tsx`
- `app/api/dashboard/route.ts`
- `lib/hooks/useDashboard.ts`
- `lib/server/analytics.ts`

#### Criteres d'acceptation

- Le dashboard charge uniquement pour admin.
- Si aucune donnee n'existe sur le mois, l'interface l'indique clairement.
- Les chiffres affiches viennent de Supabase, pas d'un fallback mock silencieux.
- Le build production passe.

---

### 2.3 Saisie quotidienne

#### Doit exister

- Selection d'une date.
- Affichage CA caisse, CA B2B, CA soir, tickets, caisse physique si disponible.
- Saisie des depenses par sections configurables.
- Sauvegarde des depenses du jour.
- Conservation des donnees POS existantes lors d'une sauvegarde manuelle.
- Acces admin et manager.

#### Fichiers concernes

- `app/(dashboard)/saisie/page.tsx`
- `app/api/daily-entry/route.ts`
- `lib/hooks/useDailyEntry.ts`
- `lib/hooks/useExpenseTemplates.ts`
- `lib/server/supabase-store.ts`
- `lib/cash.ts`

#### Criteres d'acceptation

- Un manager peut creer ou modifier les depenses du jour.
- Une sauvegarde de depenses ne remplace pas les donnees importees du POS.
- Les depenses sont persistantes apres refresh.
- Les erreurs de sauvegarde sont visibles par l'utilisateur.

---

### 2.4 Vue semaine

#### Doit exister

- Vue 7 jours.
- Totaux CA, depenses, cash, solde caisse.
- Indication des jours incomplets.
- Acces admin et manager.

#### Fichiers concernes

- `app/(dashboard)/semaine/page.tsx`
- `app/api/week/route.ts`
- `components/saisie/WeekGrid.tsx`
- `lib/hooks/useWeekView.ts`
- `lib/hooks/useWeekEntries.ts`
- `lib/server/analytics.ts`

#### Criteres d'acceptation

- La semaine charge pour manager.
- Les calculs utilisent la meme logique que le reporting.
- Les mouvements de caisse ne sont pas double-comptes avec les depenses.

---

### 2.5 Import POS et journal de caisse

#### Doit exister

- Import CSV manuel avec preview.
- Detection des doublons.
- Commit explicite.
- Historique des imports.
- Synchronisation POS ventes.
- Synchronisation journal de caisse.
- Stockage du fichier brut dans Supabase Storage.
- `pos_imports.storage_path` renseigne pour chaque import ayant un fichier source.

#### Fichiers concernes

- `app/(dashboard)/import/page.tsx`
- `app/api/import-csv/route.ts`
- `app/api/pos-sync/route.ts`
- `app/api/pos-sync/journal/route.ts`
- `lib/csv-parser.ts`
- `lib/sales-workbook-parser.ts`
- `lib/pos-journal-parser.ts`
- `supabase/migrations/20260407180000_init.sql`

#### Criteres d'acceptation

- L'admin peut importer un fichier et voir les lignes avant validation.
- Le fichier brut est archive.
- L'historique d'import permet de retrouver le fichier source.
- Un import partiel ou en erreur est visible.
- Le systeme ne cree pas de donnees mock en cas d'import vide.

---

### 2.6 Charges fixes

#### Doit exister

- Liste des charges actives.
- Creation d'une charge.
- Modification du montant.
- Desactivation d'une charge.
- Date de debut et date de fin exploitees.
- Historique des modifications dans `charge_history`.
- Simulation simple d'impact sur le seuil de rentabilite.

#### Fichiers concernes

- `app/(dashboard)/charges/page.tsx`
- `app/api/charges/route.ts`
- `lib/hooks/useCharges.ts`
- `lib/server/supabase-store.ts`
- `supabase/migrations/20260407180000_init.sql`

#### Criteres d'acceptation

- Seul admin peut acceder au module.
- Une modification de charge cree une entree d'historique.
- Une charge desactivee ne compte plus dans le seuil courant.
- La simulation ne modifie pas les donnees tant qu'elle n'est pas appliquee explicitement.

---

### 2.7 Objectifs et plan d'action

#### Doit exister

- Consultation objectif annuel.
- Consultation et edition des objectifs mensuels.
- Creation, modification, suppression d'actions.
- Changement de statut d'une action.
- Cas metier licence alcool avec impact sur objectifs futurs.

#### Hors V1

- Multi-scenarios avances.
- Workflow d'approbation.
- Historique detaille des changements d'objectifs.

#### Fichiers concernes

- `app/(dashboard)/objectifs/page.tsx`
- `app/api/objectives/route.ts`
- `app/api/objectives/monthly/route.ts`
- `app/api/objectives/alcool-validate/route.ts`
- `lib/hooks/useObjectives.ts`
- `lib/server/supabase-store.ts`

#### Criteres d'acceptation

- Seul admin peut acceder au module.
- Les actions CRUD persistent apres refresh.
- Les objectifs mensuels modifies persistent apres refresh.
- La validation alcool met a jour les mois futurs et marque l'action comme terminee.

---

### 2.8 Reporting

#### Doit exister

- Rapport mensuel lisible.
- Repartition CA caisse / B2B / soir.
- Depenses par categorie.
- Cash suivi et anomalies.
- Comparaison annee courante vs annee precedente.
- Export CSV :
  - ventes et cash
  - depenses
  - comparaison annuelle

#### Hors V1 acceptable

- PDF automatique si la V1 est lancee en usage interne uniquement.

#### Recommandation

Si le PDF reste absent au lancement, l'interface ne doit pas promettre un export PDF.

#### Fichiers concernes

- `app/(dashboard)/reporting/page.tsx`
- `app/api/reporting/route.ts`
- `app/api/reporting/export/route.ts`
- `lib/server/analytics.ts`
- `specs/07-REPORTING.md`

#### Criteres d'acceptation

- Les exports CSV s'ouvrent correctement.
- Le reporting ne masque pas les mois sans donnees.
- Les anomalies de caisse sont visibles.
- Les chiffres du reporting correspondent aux chiffres du dashboard pour le meme mois.

---

## 3. Data model V1

### 3.1 Tables critiques

La V1 depend au minimum de :

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

### 3.2 Regles data

- Supabase est la source de verite runtime.
- Les mocks ne doivent pas alimenter les routes de production.
- Les seeds doivent etre explicites, via scripts.
- Les imports doivent etre tracables.
- Les donnees POS importees ne doivent pas etre ecrasees par une saisie manuelle.
- `mouvement_caisse` represente un mouvement physique de cash.
- Les depenses `CHARGES` representent une lecture analytique.
- Aucun calcul ne doit additionner deux fois le meme mouvement.

### 3.3 Fichiers concernes

- `lib/server/supabase-store.ts`
- `lib/mock-data.ts`
- `lib/server/analytics.ts`
- `lib/cash.ts`
- `supabase/migrations/*`

### 3.4 Criteres d'acceptation

- Aucune route API ne declenche un seed implicite.
- Les scripts de seed sont documentes.
- Les tests couvrent la separation cash physique / depenses analytiques.

---

## 4. Securite V1

### 4.1 Regles obligatoires

- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` cote client.
- Ne jamais prefixer la service role key par `NEXT_PUBLIC_`.
- Ne jamais lire le role depuis `user_metadata`.
- Les pages sensibles doivent etre protegees par middleware.
- Les API sensibles doivent verifier la session et le role.
- Les tables publiques exposees doivent avoir RLS active.
- Les fonctions `SECURITY DEFINER` doivent etre limitees et documentees.

### 4.2 Points a verifier avant lancement

- `profiles` existe et contient les roles attendus.
- `auth_user_role()` lit depuis `profiles`.
- Les policies anciennes basees sur `user_metadata` sont bien remplacees.
- Le manager ne peut pas lire les endpoints admin.
- Le manager ne peut pas muter les donnees admin.

### 4.3 Fichiers concernes

- `lib/supabase/admin.ts`
- `lib/supabase/server.ts`
- `lib/supabase/middleware.ts`
- `supabase/migrations/20260410000000_p0_profiles_schema_fixes.sql`
- `supabase/migrations/20260412110000_harden_profile_bootstrap.sql`

---

## 5. Tests obligatoires V1

### 5.1 Test command

La commande suivante doit passer :

```bash
npm test
```

La commande suivante doit passer :

```bash
npm run build
```

### 5.2 Tests minimum

- Calculs financiers.
- Reporting analytics.
- Separation cash journal / mouvement caisse / depenses.
- Parser CSV ventes.
- Parser journal caisse.
- Middleware admin/manager.
- API daily-entry avec manager.
- API admin interdite au manager.
- Import CSV preview et commit.

### 5.3 Gap actuel connu

Vitest peut ramasser les tests dans `.worktrees/` si ce dossier existe localement. La config doit exclure ce dossier.

#### Fichier concerne

- `vitest.config.ts`

---

## 6. Documentation obligatoire V1

Le `README.md` doit contenir :

- presentation courte du projet
- prerequis
- variables d'environnement
- installation
- migrations Supabase
- bootstrap auth
- seed donnees
- lancement local
- tests
- build production
- deploiement Vercel
- checklist avant mise en prod
- procedure de rollback minimale

Le fichier `.env.example` doit lister toutes les variables requises :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALASKA_ADMIN_EMAIL`
- `ALASKA_ADMIN_PASSWORD`
- `ALASKA_MANAGER_EMAIL`
- `ALASKA_MANAGER_PASSWORD`
- `POS_API_URL`
- `POS_JOURNAL_API_URL`
- `POS_CAISSE_ID`
- `POS_API_TOKEN`

---

## 7. Critere global de lancement

La V1 est lancable seulement si toutes les conditions suivantes sont vraies :

- `npm test` passe.
- `npm run build` passe.
- Aucun seed runtime implicite n'est appele par les routes API.
- Les imports stockent le fichier brut ou la decision de reporter cette exigence est explicite.
- Le manager ne peut acceder qu'a `/saisie` et `/semaine`.
- Les API admin retournent `403` pour manager.
- Le README permet a une autre personne de lancer le projet.
- Les chiffres dashboard, semaine et reporting sont coherents sur un meme mois.
- Les mots de passe par defaut ne sont pas utilises en production.

---

## 8. Plan d'execution recommande

### P0 — fermer le socle

1. Corriger `vitest.config.ts` pour exclure `.worktrees/`.
2. Supprimer ou isoler `ensureSeedData` du runtime applicatif.
3. Ajouter les tests d'autorisation API admin vs manager.
4. Durcir `scripts/bootstrap-auth.mjs` pour refuser les mots de passe par defaut en production.
5. Completer le README d'exploitation.

### P1 — fermer la data

1. Archiver les fichiers sources d'import dans Supabase Storage.
2. Renseigner `pos_imports.storage_path`.
3. Ajouter l'historique `charge_history` sur modification/desactivation.
4. Ajouter des tests de non double-comptage cash.
5. Verifier la coherence dashboard/semaine/reporting sur un jeu de donnees fixe.

### P2 — fermer le produit

1. Clarifier l'etat vide sur dashboard/reporting/import.
2. Retirer toute promesse UI de PDF tant que le PDF n'existe pas.
3. Finaliser l'edition des objectifs annuels si elle est requise pour exploitation.
4. Ajouter messages d'erreur utilisateurs sur charges/objectifs/import.
5. Faire une passe mobile sur les 6 pages principales.

---

## 9. Non-objectifs V1

Ces sujets ne doivent pas bloquer la V1 :

- PWA installable.
- Offline.
- Notifications.
- PDF automatique si CSV et reporting web suffisent pour usage interne.
- Multi-restaurant.
- Comptabilite complete.
- Gestion fournisseurs complete.
- Permissions granulaires au-dela de `admin` et `manager`.

---

## 10. Definition of done finale

La V1 est consideree terminee quand :

1. Les tests et le build passent en local.
2. Les migrations sont appliquees sur Supabase.
3. Deux comptes reels existent : admin et manager.
4. Les donnees historiques sont chargees par script explicite.
5. Un import POS ventes fonctionne.
6. Un import journal caisse fonctionne.
7. Une saisie manager fonctionne.
8. Le dashboard admin affiche le mois courant sans erreur.
9. Le reporting exporte les CSV.
10. Le README explique comment refaire tout cela.

Quand ces dix points sont vrais, le projet peut passer en V1 interne.
