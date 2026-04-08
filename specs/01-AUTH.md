# Spec 01 — Authentification & Rôles

---

## 1. Vue d'ensemble

Authentification par **email + mot de passe** via Supabase Auth. Deux rôles fixes définis à la création du compte. Pas de système d'inscription public — les deux comptes sont créés manuellement par le développeur à l'initialisation.

---

## 2. Utilisateurs

| Champ | Admin (Othman) | Manager (Responsable) |
|---|---|---|
| Email | configurable à l'init | configurable à l'init |
| Rôle | `admin` | `manager` |
| Langue UI | Français | Français |
| Redirect après login | `/` (Dashboard) | `/saisie` |

---

## 3. Flux d'authentification

### Login
1. Page `/login` : formulaire email + mot de passe
2. Appel `supabase.auth.signInWithPassword()`
3. En cas d'erreur : message "Email ou mot de passe incorrect"
4. En cas de succès : redirect selon le rôle
   - `admin` → `/` (dashboard)
   - `manager` → `/saisie`

### Session
- Session maintenue via cookies Supabase (SSR compatible Next.js)
- Token rafraîchi automatiquement
- Durée de session : 7 jours (configurable dans Supabase)

### Logout
- Bouton "Déconnexion" dans le menu
- Appel `supabase.auth.signOut()`
- Redirect vers `/login`

### Mot de passe oublié
- Lien "Mot de passe oublié" sur `/login`
- Email Supabase de reset (configurer le template en français)

---

## 4. Contrôle d'accès (Route Protection)

### Middleware Next.js (`middleware.ts`)
```
Routes protégées (auth requise) : /*, sauf /login
Routes admin uniquement : /charges, /objectifs, /import, /reporting
Routes partagées : /saisie, /semaine
```

### Comportement
- Non authentifié sur route protégée → redirect `/login`
- Manager sur route admin → redirect `/saisie` + toast "Accès non autorisé"
- Admin sur toutes les routes → accès normal

---

## 5. Rôle : `admin` (Othman)

Accès complet à :
- Dashboard principal avec tous les KPIs
- Gestion des charges fixes (ajout, modification, suppression)
- Import CSV mensuel de la caisse
- Objectifs annuels et plan d'action
- Reporting et exports
- Saisie et vue semaine (comme le manager)
- **Peut voir toutes les saisies faites par le manager**

---

## 6. Rôle : `manager` (Responsable resto)

Accès limité à :
- **Saisie quotidienne** : CA caisse du jour + dépenses (MP + personnel)
- **Vue semaine** : résumé 7 jours (CA, dépenses, marge)
- **Pas d'accès** : charges fixes, objectifs, imports, reporting financier détaillé

Ce que le manager **ne voit pas** :
- Les projections annuelles et objectifs
- Le détail des charges fixes (loyer, etc.)
- Les comparaisons vs business plan
- Les exports comptables

> **Raison** : le manager connaît les opérations quotidiennes mais n'a pas besoin de voir la stratégie financière.

---

## 7. Sécurité Supabase RLS (Row Level Security)

Chaque table doit avoir des policies RLS adaptées :

```sql
-- Exemple : table expenses
-- Admin voit tout
CREATE POLICY "admin_all" ON expenses
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Manager voit et crée uniquement ses propres saisies
CREATE POLICY "manager_own" ON expenses
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "manager_insert" ON expenses
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'manager');
```

Le rôle est stocké dans les metadata Supabase user lors de la création du compte :
```json
{ "role": "admin" }
```

---

## 8. Navigation UI par rôle

### Admin — Sidebar / Bottom Nav
```
📊 Dashboard
✏️  Saisie
📅  Semaine
⚙️  Charges
🎯  Objectifs
📤  Import CSV
📄  Reporting
```

### Manager — Bottom Nav seulement (pas de sidebar)
```
✏️  Saisie
📅  Semaine
```

---

## 9. Page Login — UI

- Logo Alaska Neo Bistrot en haut
- Titre : "Pilotage Alaska"
- Champ email + mot de passe
- Bouton "Se connecter" (primary)
- Lien "Mot de passe oublié ?"
- Pas de lien "Créer un compte" (accès sur invitation uniquement)
- Fond sombre avec la couleur `#1F3864`

---

## 10. Gestion d'erreurs auth

| Cas | Message affiché |
|---|---|
| Email invalide | "Adresse email invalide" |
| Mot de passe incorrect | "Email ou mot de passe incorrect" |
| Compte inexistant | "Email ou mot de passe incorrect" (ne pas révéler l'existence) |
| Trop de tentatives | "Trop de tentatives. Réessayez dans X minutes." |
| Erreur réseau | "Impossible de se connecter. Vérifiez votre connexion." |
