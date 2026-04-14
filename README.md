# Alaska Pilot

## Présentation courte du projet

Alaska Pilot est la webapp interne de pilotage financier du restaurant Alaska Neo Bistrot à Rabat. Elle remplace le suivi Excel manuel par une application Next.js 14 + Supabase pour suivre le chiffre d'affaires POS, la caisse physique, les dépenses, les charges fixes, les objectifs et le reporting mensuel.

La source de vérité runtime est Supabase/PostgreSQL. Les rôles applicatifs sont `admin` et `manager`, stockés dans `public.profiles`. Les décisions de sécurité ne doivent jamais lire `user_metadata`.

## Prérequis

- Node.js 20 ou plus récent.
- npm.
- Supabase CLI local, déjà déclaré en dépendance de développement (`npx supabase --version`).
- Un projet Supabase avec les migrations du dossier `supabase/migrations`.
- Un projet Vercel pour le déploiement production.

## Variables d'environnement

Copier `.env.example` vers `.env.local`, puis renseigner les valeurs du projet Supabase et du POS.

Variables requises côté application :

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Variables requises pour créer les comptes initiaux :

```bash
ALASKA_ADMIN_EMAIL=
ALASKA_ADMIN_PASSWORD=
ALASKA_MANAGER_EMAIL=
ALASKA_MANAGER_PASSWORD=
```

Variables requises pour la synchronisation POS :

```bash
POS_API_URL=
POS_JOURNAL_API_URL=
POS_CAISSE_ID=
POS_API_TOKEN=
```

Règles de sécurité :

- `SUPABASE_SERVICE_ROLE_KEY` reste uniquement côté serveur ou scripts.
- Ne jamais créer de variable `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
- Les mots de passe par défaut ne doivent pas être utilisés en production.

## Installation

Installer les dépendances :

```bash
npm install
```

Vérifier que la configuration locale existe :

```bash
copy .env.example .env.local
```

Sous macOS ou Linux :

```bash
cp .env.example .env.local
```

## Migrations Supabase

Lier le projet Supabase si nécessaire :

```bash
npx supabase link --project-ref <project-ref>
```

Appliquer les migrations :

```bash
npx supabase db push
```

Les migrations principales créent les tables métier, les profils, les politiques RLS, les templates de dépenses et le journal de caisse. Vérifier dans Supabase que `profiles`, `daily_sales`, `expenses`, `fixed_charges`, `charge_history`, `objectives`, `monthly_objectives`, `action_items`, `pos_imports`, `expense_sections` et `expense_item_templates` existent après application.

## Bootstrap auth

Créer ou mettre à jour les deux comptes V1 :

```bash
node --env-file=.env.local scripts/bootstrap-auth.mjs
```

Le script utilise `SUPABASE_SERVICE_ROLE_KEY`, crée les utilisateurs Supabase Auth si besoin, puis écrit les rôles dans `public.profiles`.

Résultat attendu :

- compte admin avec rôle `admin`
- compte manager avec rôle `manager`

Le manager doit accéder uniquement à `/saisie` et `/semaine`. L'admin doit accéder à toutes les pages.

## Seed données

Aucun seed automatique ne doit être appelé par les routes API. Les données historiques sont chargées uniquement avec un script explicite.

Importer l'historique Excel :

```bash
node --env-file=.env.local scripts/seed-from-excel.mjs "<chemin/vers/Alaska_Suivi_Semaines_2026.xlsx>"
```

Importer un export POS CSV complet :

```bash
node --env-file=.env.local scripts/import-pos-csv.mjs "<chemin/vers/export-pos.csv>"
```

Après un seed, ouvrir le dashboard et vérifier que le mois attendu affiche le CA total, les dépenses et les jours importés.

## Lancement local

Démarrer Next.js :

```bash
npm run dev
```

Ouvrir `http://localhost:3000`, puis se connecter avec le compte admin ou manager créé par le bootstrap.

## Tests

Lancer la suite Vitest :

```bash
npm test
```

La suite couvre les calculs financiers, les parsers POS, le journal de caisse, les analytics et le middleware d'accès.

Lancer aussi les contrôles qualité complets avant livraison :

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Build production

Construire l'application :

```bash
npm run build
```

Tester le build localement si nécessaire :

```bash
npm run start
```

Le build doit passer sans fallback mock silencieux et sans dépendre d'un seed runtime.

## Déploiement Vercel

Configurer les variables d'environnement dans Vercel pour Production et Preview :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `POS_API_URL`
- `POS_JOURNAL_API_URL`
- `POS_CAISSE_ID`
- `POS_API_TOKEN`

Déployer depuis la branche validée :

```bash
vercel deploy --prod
```

Après déploiement, vérifier :

- connexion admin
- connexion manager
- accès manager limité à `/saisie` et `/semaine`
- dashboard admin
- saisie d'une dépense manager
- import POS ventes
- import journal caisse
- reporting et exports CSV

## Checklist avant mise en prod

- `npm test` passe.
- `npm run lint` passe.
- `npx tsc --noEmit` passe.
- `npm run build` passe.
- Les migrations Supabase sont appliquées.
- `SUPABASE_SERVICE_ROLE_KEY` est configurée côté serveur uniquement.
- Les comptes admin et manager réels existent.
- Les rôles sont présents dans `public.profiles`.
- Les mots de passe par défaut ne sont pas utilisés.
- Aucun rôle n'est lu depuis `user_metadata` pour l'autorisation.
- Aucun seed automatique n'est appelé par les routes API.
- `ca_total = ca_caisse + ca_b2b` reste la base des KPIs.
- Les imports POS et journal caisse fonctionnent sur des fichiers réels.
- Le reporting exporte les CSV attendus.

## Procédure de rollback minimale

1. Identifier le dernier déploiement Vercel stable.
2. Restaurer ou promouvoir ce déploiement depuis le dashboard Vercel.
3. Si une migration Supabase a cassé la production, restaurer la base depuis le backup Supabase correspondant ou appliquer une migration corrective validée.
4. Rejouer `npm test`, `npm run lint`, `npx tsc --noEmit` et `npm run build` sur la branche de correction.
5. Redéployer uniquement après validation des accès admin/manager et des routes API critiques.
