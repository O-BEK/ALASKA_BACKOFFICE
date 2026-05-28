# Intégration IA — Design Spec

**Date :** 2026-05-28  
**Projet :** Alaska Pilot — Alaska Neo Bistrot (Rabat, Maroc)  
**Scope :** Assistant IA financier — chat flottant, annotations calendaires, résumé mensuel IA

---

## Contexte

Alaska Pilot pilote le CA, les dépenses et les charges d'Alaska Neo Bistrot. Le gérant veut pouvoir interroger ses données en langage naturel et voir automatiquement le contexte calendaire (Ramadan, Aïd al-Adha, vacances scolaires Rabat) dans les pages financières, car ces événements impactent fortement le CA et rendent les comparaisons N-1 naïves trompeuses.

---

## Architecture globale

```
┌─────────────────────────────────────────────────────────┐
│                    ALASKA PILOT APP                      │
│                                                          │
│  Dashboard / Reporting / Semaine / Saisie                │
│       │                        │                        │
│  ┌────▼──────────────┐   ┌─────▼──────────────────┐    │
│  │  Annotation Engine │   │   Chat Flottant (bulle) │    │
│  │  (100% code, 0 IA) │   │   + Résumé IA mensuel  │    │
│  └────────────────────┘   └────────────────────────┘    │
│       │                        │                        │
│  ┌────▼────────────────────────▼──────────────────┐     │
│  │              Supabase                           │     │
│  │  daily_sales · expenses · calendar_events       │     │
│  │  ai_monthly_summaries (cache résumés IA)        │     │
│  └─────────────────────────────────────────────────┘    │
│                        │                                 │
│                  ┌─────▼──────────┐                     │
│                  │  Claude API    │  ← action explicite  │
│                  │  (Anthropic)   │     uniquement        │
│                  └────────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

**Principe de consommation tokens :**
- Changement de page → **0 token**
- Message chat envoyé → **1 appel Claude Haiku**
- Bouton "Générer l'analyse" → **1 appel Claude Sonnet** (résultat mis en cache)

---

## Section 1 : Calendrier & Événements

### Table Supabase `calendar_events`

```sql
CREATE TABLE calendar_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_start  date NOT NULL,
  date_end    date NOT NULL,
  type        text NOT NULL CHECK (type IN (
                'school_holiday', 'public_holiday', 'religious', 'closure', 'high_traffic'
              )),
  name        text NOT NULL,
  impact      text NOT NULL CHECK (impact IN ('closed', 'reduced', 'boost')),
  notes       text,
  editable    boolean DEFAULT true,  -- false pour jours fériés officiels
  created_at  timestamptz DEFAULT now()
);
```

### Données pré-chargées (migration SQL)

Couverture 2025–2027 :

| Catégorie | Exemples |
|---|---|
| Vacances scolaires Rabat | Toussaint, Noël, hiver, printemps, été (académie Rabat-Salé-Kénitra) |
| Jours fériés officiels | Fête du Trône (30 juil), Marche Verte (6 nov), Fête de l'Indépendance (18 nov)... |
| Ramadan | Dates 2025/2026/2027 via calendrier hégirien |
| Aïd al-Fitr | Dates 2025/2026/2027 |
| Aïd al-Adha | Dates 2025/2026/2027 |
| Fermetures exceptionnelles | Vide par défaut — saisies par l'admin |

Les jours fériés officiels ont `editable = false` (lecture seule dans l'UI).

### Écran admin `/calendrier`

- Accès : **admin uniquement**
- Vue liste mois par mois, filtrée par année
- Bouton "Ajouter fermeture" → formulaire : date_start, date_end, name, impact (closed/reduced/boost), notes
- Édition/suppression des événements `editable = true`
- Les événements `editable = false` affichent un cadenas — non modifiables depuis l'UI

---

## Section 2 : Annotation Engine

### Fichier `lib/server/calendar-context.ts`

Fonctions pures — aucun appel réseau, aucun token IA.

```ts
type CalendarAnnotation = {
  type: 'warning' | 'info' | 'boost' | 'correction'
  icon: string
  label: string         // ex: "Aïd al-Adha"
  detail: string        // ex: "3 jours de fermeture inclus dans cette période"
  ca_adjusted?: number  // CA recalculé sur jours ouverts seulement
  vs_n1_note?: string   // ex: "Comparaison N-1 décalée (Aïd était en sem. 35 en 2025)"
}

function getAnnotationsForPeriod(
  dateStart: Date,
  dateEnd: Date,
  events: CalendarEvent[],
  caTotal: number
): CalendarAnnotation[]

function getCaAdjusted(
  caTotal: number,
  daysOpen: number,
  daysInPeriod: number
): number

function isN1ComparisonValid(
  period: DateRange,
  periodN1: DateRange,
  events: CalendarEvent[]
): { valid: boolean; note?: string }
```

**Formule CA corrigé :**
```
ca_corrigé = ca_total / jours_ouverts * jours_du_mois
```

### Annotations par page

| Page | Annotation |
|---|---|
| **Dashboard** | Badge ⚠️ sur KPI CA si fermeture/Ramadan dans le mois + CA corrigé entre parenthèses + note comparaison N-1 si décalée |
| **Vue Semaine** | Bandeau en haut de grille si la semaine chevauche un événement |
| **Reporting** | Section "Contexte calendaire" avant les chiffres — liste événements du mois, impact estimé, note comparaison N-1 |
| **Saisie** | Badge discret sur la date courante si jour férié/vacances |

**Exemple dashboard :**
```
CA Mai 2026    47 200 MAD  ⚠️ Aïd al-Adha
               (54 800 MAD corrigé — 3 jours fermé exclus)
               ↕ Comparaison mai 2025 décalée (Aïd était en sem. 35)
```

---

## Section 3 : Chat Flottant

### UI

- Bulle fixe bas-droite sur toutes les pages `(dashboard)`
- Clic → drawer latéral sur desktop, modal plein écran sur mobile
- Historique de conversation dans la session (non persisté en base)
- Indicateur de frappe pendant l'appel Claude

### Route API `POST /api/ai/chat`

**Contrôle d'accès :** vérifie session Supabase — admin et manager autorisés.

**Contexte injecté automatiquement à chaque message :**

```
- Date du jour + événements calendrier actifs
- CA du mois en cours (total, caisse, B2B)
- CA même mois N-1
- Dépenses du mois par catégorie (MP, RH, CHARGES, AUTRE)
- Objectif mensuel + écart
- 3 dernières semaines de daily_sales (résumé)
- Événements calendar_events du mois en cours + 30 derniers jours
```

**Prompt système :**
```
Tu es l'assistant financier d'Alaska Neo Bistrot, un restaurant à Rabat (Maroc).
Tu analyses les données financières et le contexte calendaire pour aider le gérant.
Réponds toujours en français, sois concis et direct.
Les montants sont en MAD (dirhams marocains).
Ne jamais inventer de chiffres — utilise uniquement les données fournies.
[données injectées]
```

**Modèle :** `claude-haiku-4-5-20251001` — rapide, économique (~0,002$/message).

**Exemples de questions supportées :**
- "Pourquoi le CA de cette semaine est bas ?"
- "On est à combien de l'objectif ce mois ?"
- "Compare avec l'année dernière en tenant compte de l'Aïd"
- "Quels sont mes jours les plus forts ce mois ?"
- "Mon food cost est à combien cette semaine ?"

---

## Section 4 : Résumé IA Mensuel

### Table Supabase `ai_monthly_summaries`

```sql
CREATE TABLE ai_monthly_summaries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month             text NOT NULL UNIQUE,  -- format YYYY-MM
  generated_at      timestamptz NOT NULL,
  summary_md        text NOT NULL,
  model_used        text NOT NULL,
  context_snapshot  jsonb                  -- données utilisées (audit)
);
```

### UI — Page `/reporting`

Section "Analyse IA" affichée sous les KPIs :

```
┌─────────────────────────────────────────────┐
│ 🤖 Analyse IA — Mai 2026                    │
│ Générée il y a 3 jours                      │
│ [Régénérer l'analyse]                        │
│                                             │
│ CA de 187 400 MAD, en hausse de +12%...     │
└─────────────────────────────────────────────┘
```

### Route API `POST /api/ai/summary`

**Contrôle d'accès :** admin uniquement.

**Logique :**
1. Vérifie si `ai_monthly_summaries` contient déjà un résumé pour le mois demandé
2. Si oui → retourne le cache (0 token)
3. Si non → appelle Claude Sonnet avec contexte complet → stocke en base → retourne

**Contexte complet envoyé à Claude Sonnet :**
- Toutes les données du mois (CA journalier, dépenses, food cost, charges)
- Comparaison N-1 avec note de validité calendaire
- Objectifs mensuels + écart
- Événements calendrier du mois
- Projections run-rate

**Modèle :** `claude-sonnet-4-6` — plus de profondeur pour l'analyse.

**Format de sortie attendu (markdown) :**
```markdown
## CA & Performance
...

## Points de vigilance
...

## Recommandations
...
```

---

## Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `lib/server/calendar-context.ts` | Annotation Engine — fonctions pures calendrier |
| `app/api/ai/chat/route.ts` | Route chat Claude Haiku |
| `app/api/ai/summary/route.ts` | Route résumé Claude Sonnet + cache |
| `components/ai/ChatBubble.tsx` | Bulle flottante + drawer |
| `components/ai/ChatMessage.tsx` | Rendu d'un message (user/assistant) |
| `components/ai/MonthlySummary.tsx` | Section résumé IA dans /reporting |
| `components/calendar/CalendarAnnotation.tsx` | Badge d'annotation contextuel |
| `app/(dashboard)/calendrier/page.tsx` | Écran admin gestion événements |
| `app/api/calendar-events/route.ts` | CRUD événements calendrier |

## Nouvelles migrations SQL

| Fichier | Contenu |
|---|---|
| `supabase/migrations/YYYYMMDD_calendar_events.sql` | Table + données 2025-2027 + RLS |
| `supabase/migrations/YYYYMMDD_ai_monthly_summaries.sql` | Table + RLS admin |

## Variable d'environnement requise

```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Règles de sécurité

- `ANTHROPIC_API_KEY` uniquement côté serveur (jamais exposée au client)
- Les routes `/api/ai/*` vérifient la session Supabase avant tout appel Claude
- Le contexte injecté à Claude ne contient jamais de données d'autres restaurants ou utilisateurs
- `context_snapshot` dans `ai_monthly_summaries` permet d'auditer ce qui a été envoyé à Claude

---

## Ce qui est hors scope (V1 IA)

- Réponses vocales
- Historique de conversation persisté en base
- Alertes push IA automatiques
- Intégration d'autres modèles (GPT, Gemini)
- IA pour catégorisation automatique des dépenses (phase 2 possible)
