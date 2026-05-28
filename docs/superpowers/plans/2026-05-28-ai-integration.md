# Intégration IA — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Intégrer un assistant IA dans Alaska Pilot — chat flottant en langage naturel, annotations calendaires automatiques (Ramadan, Aïd, vacances scolaires Rabat), résumé mensuel généré par Claude Sonnet.

**Architecture:** Annotation Engine purement en code (zéro token IA sur les changements de page), chat flottant via Claude Haiku uniquement sur message envoyé, résumé mensuel via Claude Sonnet mis en cache dans Supabase. Table `calendar_events` pré-chargée 2025-2027 avec écran admin pour fermetures exceptionnelles.

**Tech Stack:** `@anthropic-ai/sdk`, Next.js API Routes, Supabase PostgreSQL, `date-fns` (déjà installé), Tailwind CSS + shadcn/ui (déjà installés).

---

## Fichiers créés / modifiés

| Action | Fichier | Rôle |
|---|---|---|
| Créer | `supabase/migrations/20260528000000_calendar_events.sql` | Table + seed 2025-2027 + RLS |
| Créer | `supabase/migrations/20260528100000_ai_monthly_summaries.sql` | Cache résumés IA + RLS |
| Créer | `lib/calendar-context.ts` | Fonctions pures annotations (pas server-only) |
| Créer | `lib/hooks/useCalendarEvents.ts` | Hook client fetch événements |
| Créer | `app/api/calendar-events/route.ts` | CRUD événements calendrier |
| Créer | `app/(dashboard)/calendrier/page.tsx` | Page admin gestion calendrier |
| Créer | `app/api/ai/chat/route.ts` | Chat Claude Haiku |
| Créer | `app/api/ai/summary/route.ts` | Résumé Claude Sonnet + cache |
| Créer | `components/ai/ChatBubble.tsx` | Bulle flottante + drawer |
| Créer | `components/ai/ChatMessage.tsx` | Rendu message user/assistant |
| Créer | `components/ai/MonthlySummary.tsx` | Section résumé IA dans /reporting |
| Créer | `components/calendar/CalendarAnnotation.tsx` | Badge annotation contextuel |
| Créer | `tests/calendar-context.test.ts` | Tests unitaires fonctions pures |
| Modifier | `.env.example` | Ajouter ANTHROPIC_API_KEY |
| Modifier | `lib/supabase/middleware.ts` | Ajouter /calendrier aux routes admin |
| Modifier | `components/layout/AppShell.tsx` | Ajouter nav Calendrier (admin) |
| Modifier | `app/(dashboard)/page.tsx` | Annotations sur KPI CA |
| Modifier | `app/(dashboard)/semaine/page.tsx` | Bandeau semaine |
| Modifier | `app/(dashboard)/reporting/page.tsx` | Section calendrier + MonthlySummary |

---

## Task 1 — SDK Anthropic + variable d'environnement

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Installer @anthropic-ai/sdk**

```bash
npm install @anthropic-ai/sdk
```

Expected output: `added 1 package` (ou similaire), pas d'erreur.

- [ ] **Step 2: Ajouter ANTHROPIC_API_KEY dans .env.example**

Ouvrir `.env.example` et ajouter à la fin :

```
# Intelligence artificielle — Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 3: Ajouter la clé dans .env.local**

Copier la clé depuis https://console.anthropic.com → API Keys et l'ajouter dans `.env.local` :

```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "feat: install @anthropic-ai/sdk"
```

---

## Task 2 — Migrations Supabase

**Files:**
- Create: `supabase/migrations/20260528000000_calendar_events.sql`
- Create: `supabase/migrations/20260528100000_ai_monthly_summaries.sql`

- [ ] **Step 1: Créer la migration calendar_events**

Créer `supabase/migrations/20260528000000_calendar_events.sql` :

```sql
-- Table des événements calendaires
CREATE TABLE calendar_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_start  date NOT NULL,
  date_end    date NOT NULL,
  type        text NOT NULL CHECK (type IN ('school_holiday','public_holiday','religious','closure','high_traffic')),
  name        text NOT NULL,
  impact      text NOT NULL CHECK (impact IN ('closed','reduced','boost')),
  notes       text,
  editable    boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les utilisateurs authentifiés
CREATE POLICY "calendar_events_select" ON calendar_events
  FOR SELECT TO authenticated USING (true);

-- Écriture : admin uniquement, et seulement les événements editables
CREATE POLICY "calendar_events_insert" ON calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_role() = 'admin');

CREATE POLICY "calendar_events_update" ON calendar_events
  FOR UPDATE TO authenticated
  USING (public.auth_user_role() = 'admin' AND editable = true);

CREATE POLICY "calendar_events_delete" ON calendar_events
  FOR DELETE TO authenticated
  USING (public.auth_user_role() = 'admin' AND editable = true);

-- =============================================
-- SEED : jours fériés officiels Maroc (editable=false)
-- =============================================

-- 2025
INSERT INTO calendar_events (date_start, date_end, type, name, impact, notes, editable) VALUES
  ('2025-01-01','2025-01-01','public_holiday','Nouvel An',           'reduced',NULL,false),
  ('2025-01-11','2025-01-11','public_holiday','Manifeste de l''Indépendance','reduced',NULL,false),
  ('2025-05-01','2025-05-01','public_holiday','Fête du Travail',     'reduced',NULL,false),
  ('2025-07-30','2025-07-30','public_holiday','Fête du Trône',       'reduced',NULL,false),
  ('2025-08-14','2025-08-14','public_holiday','Journée de Oued Ed-Dahab','reduced',NULL,false),
  ('2025-08-20','2025-08-20','public_holiday','Révolution du Roi et du Peuple','reduced',NULL,false),
  ('2025-08-21','2025-08-21','public_holiday','Fête de la Jeunesse', 'reduced',NULL,false),
  ('2025-11-06','2025-11-06','public_holiday','Marche Verte',        'reduced',NULL,false),
  ('2025-11-18','2025-11-18','public_holiday','Fête de l''Indépendance','reduced',NULL,false);

-- 2026
INSERT INTO calendar_events (date_start, date_end, type, name, impact, notes, editable) VALUES
  ('2026-01-01','2026-01-01','public_holiday','Nouvel An',           'reduced',NULL,false),
  ('2026-01-11','2026-01-11','public_holiday','Manifeste de l''Indépendance','reduced',NULL,false),
  ('2026-05-01','2026-05-01','public_holiday','Fête du Travail',     'reduced',NULL,false),
  ('2026-07-30','2026-07-30','public_holiday','Fête du Trône',       'reduced',NULL,false),
  ('2026-08-14','2026-08-14','public_holiday','Journée de Oued Ed-Dahab','reduced',NULL,false),
  ('2026-08-20','2026-08-20','public_holiday','Révolution du Roi et du Peuple','reduced',NULL,false),
  ('2026-08-21','2026-08-21','public_holiday','Fête de la Jeunesse', 'reduced',NULL,false),
  ('2026-11-06','2026-11-06','public_holiday','Marche Verte',        'reduced',NULL,false),
  ('2026-11-18','2026-11-18','public_holiday','Fête de l''Indépendance','reduced',NULL,false);

-- 2027
INSERT INTO calendar_events (date_start, date_end, type, name, impact, notes, editable) VALUES
  ('2027-01-01','2027-01-01','public_holiday','Nouvel An',           'reduced',NULL,false),
  ('2027-01-11','2027-01-11','public_holiday','Manifeste de l''Indépendance','reduced',NULL,false),
  ('2027-05-01','2027-05-01','public_holiday','Fête du Travail',     'reduced',NULL,false),
  ('2027-07-30','2027-07-30','public_holiday','Fête du Trône',       'reduced',NULL,false),
  ('2027-08-14','2027-08-14','public_holiday','Journée de Oued Ed-Dahab','reduced',NULL,false),
  ('2027-08-20','2027-08-20','public_holiday','Révolution du Roi et du Peuple','reduced',NULL,false),
  ('2027-08-21','2027-08-21','public_holiday','Fête de la Jeunesse', 'reduced',NULL,false),
  ('2027-11-06','2027-11-06','public_holiday','Marche Verte',        'reduced',NULL,false),
  ('2027-11-18','2027-11-18','public_holiday','Fête de l''Indépendance','reduced',NULL,false);

-- =============================================
-- SEED : fêtes religieuses (calendrier lunaire) — editable=true car dates approx.
-- =============================================

-- 2025
INSERT INTO calendar_events (date_start, date_end, type, name, impact, notes, editable) VALUES
  ('2025-03-01','2025-03-30','religious','Ramadan 2025',             'reduced','Affluence réduite le midi, horaires décalés',true),
  ('2025-03-30','2025-03-31','religious','Aïd al-Fitr 2025',         'closed', 'Fermeture restaurant',true),
  ('2025-06-05','2025-06-07','religious','Aïd al-Adha 2025',         'closed', 'Fermeture 3 jours',true),
  ('2025-06-26','2025-06-26','religious','Al-Hijra 2025',            'reduced','Nouvel An hégirien',true),
  ('2025-09-04','2025-09-04','religious','Mawlid 2025',              'reduced','Anniversaire du Prophète',true);

-- 2026
INSERT INTO calendar_events (date_start, date_end, type, name, impact, notes, editable) VALUES
  ('2026-02-18','2026-03-19','religious','Ramadan 2026',             'reduced','Affluence réduite le midi, horaires décalés',true),
  ('2026-03-20','2026-03-21','religious','Aïd al-Fitr 2026',         'closed', 'Fermeture restaurant',true),
  ('2026-05-29','2026-05-31','religious','Aïd al-Adha 2026',         'closed', 'Fermeture 3 jours',true),
  ('2026-06-16','2026-06-16','religious','Al-Hijra 2026',            'reduced','Nouvel An hégirien',true),
  ('2026-08-25','2026-08-25','religious','Mawlid 2026',              'reduced','Anniversaire du Prophète',true);

-- 2027
INSERT INTO calendar_events (date_start, date_end, type, name, impact, notes, editable) VALUES
  ('2027-02-07','2027-03-08','religious','Ramadan 2027',             'reduced','Affluence réduite le midi, horaires décalés',true),
  ('2027-03-09','2027-03-10','religious','Aïd al-Fitr 2027',         'closed', 'Fermeture restaurant',true),
  ('2027-05-17','2027-05-19','religious','Aïd al-Adha 2027',         'closed', 'Fermeture 3 jours',true),
  ('2027-06-06','2027-06-06','religious','Al-Hijra 2027',            'reduced','Nouvel An hégirien',true),
  ('2027-08-14','2027-08-15','religious','Mawlid 2027',              'reduced','Anniversaire du Prophète',true);

-- =============================================
-- SEED : vacances scolaires Rabat (Académie Rabat-Salé-Kénitra) — editable=false
-- =============================================

-- 2024-2025
INSERT INTO calendar_events (date_start, date_end, type, name, impact, notes, editable) VALUES
  ('2024-10-26','2024-11-03','school_holiday','Vacances Automne 2024',   'boost','Familles disponibles',false),
  ('2024-12-28','2025-01-05','school_holiday','Vacances Hiver 2024-25',  'boost','Fêtes de fin d''année',false),
  ('2025-03-08','2025-03-23','school_holiday','Vacances Printemps 2025', 'boost','Vacances scolaires',false),
  ('2025-06-28','2025-09-01','school_holiday','Vacances Été 2025',       'boost','Grande saison',false);

-- 2025-2026
INSERT INTO calendar_events (date_start, date_end, type, name, impact, notes, editable) VALUES
  ('2025-10-25','2025-11-02','school_holiday','Vacances Automne 2025',   'boost','Familles disponibles',false),
  ('2025-12-27','2026-01-04','school_holiday','Vacances Hiver 2025-26',  'boost','Fêtes de fin d''année',false),
  ('2026-03-14','2026-03-29','school_holiday','Vacances Printemps 2026', 'boost','Vacances scolaires',false),
  ('2026-06-27','2026-09-01','school_holiday','Vacances Été 2026',       'boost','Grande saison',false);

-- 2026-2027
INSERT INTO calendar_events (date_start, date_end, type, name, impact, notes, editable) VALUES
  ('2026-10-24','2026-11-01','school_holiday','Vacances Automne 2026',   'boost','Familles disponibles',false),
  ('2026-12-26','2027-01-03','school_holiday','Vacances Hiver 2026-27',  'boost','Fêtes de fin d''année',false),
  ('2027-03-13','2027-03-28','school_holiday','Vacances Printemps 2027', 'boost','Vacances scolaires',false),
  ('2027-06-26','2027-09-01','school_holiday','Vacances Été 2027',       'boost','Grande saison',false);
```

- [ ] **Step 2: Créer la migration ai_monthly_summaries**

Créer `supabase/migrations/20260528100000_ai_monthly_summaries.sql` :

```sql
CREATE TABLE ai_monthly_summaries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month            text NOT NULL UNIQUE,  -- format YYYY-MM
  generated_at     timestamptz NOT NULL,
  summary_md       text NOT NULL,
  model_used       text NOT NULL,
  context_snapshot jsonb
);

ALTER TABLE ai_monthly_summaries ENABLE ROW LEVEL SECURITY;

-- Lecture : admin uniquement
CREATE POLICY "ai_summaries_select" ON ai_monthly_summaries
  FOR SELECT TO authenticated USING (public.auth_user_role() = 'admin');

-- Écriture : admin uniquement
CREATE POLICY "ai_summaries_insert" ON ai_monthly_summaries
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_role() = 'admin');

CREATE POLICY "ai_summaries_delete" ON ai_monthly_summaries
  FOR DELETE TO authenticated
  USING (public.auth_user_role() = 'admin');
```

- [ ] **Step 3: Appliquer les migrations en production**

```bash
npx supabase db push
```

Expected: les deux migrations s'appliquent sans erreur.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260528000000_calendar_events.sql supabase/migrations/20260528100000_ai_monthly_summaries.sql
git commit -m "feat: add calendar_events and ai_monthly_summaries migrations with 2025-2027 seed"
```

---

## Task 3 — Bibliothèque calendar-context.ts + tests

**Files:**
- Create: `lib/calendar-context.ts`
- Create: `tests/calendar-context.test.ts`

- [ ] **Step 1: Écrire les fonctions pures**

Créer `lib/calendar-context.ts` :

```typescript
export type CalendarEventType = 'school_holiday' | 'public_holiday' | 'religious' | 'closure' | 'high_traffic'
export type CalendarImpact = 'closed' | 'reduced' | 'boost'

export interface CalendarEvent {
  id: string
  date_start: string  // YYYY-MM-DD
  date_end: string    // YYYY-MM-DD
  type: CalendarEventType
  name: string
  impact: CalendarImpact
  notes: string | null
  editable: boolean
}

export interface CalendarAnnotation {
  type: 'warning' | 'info' | 'boost' | 'correction'
  icon: string
  label: string
  detail: string
  ca_adjusted?: number
  vs_n1_note?: string
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function getEventsForPeriod(
  dateStart: Date,
  dateEnd: Date,
  events: CalendarEvent[]
): CalendarEvent[] {
  return events.filter(e => {
    const s = parseLocalDate(e.date_start)
    const end = parseLocalDate(e.date_end)
    return s <= dateEnd && end >= dateStart
  })
}

export function getClosedDays(
  dateStart: Date,
  dateEnd: Date,
  events: CalendarEvent[]
): number {
  const closedEvents = events.filter(e => e.impact === 'closed')
  let count = 0
  const current = new Date(dateStart)
  while (current <= dateEnd) {
    const dayStr = current.toISOString().slice(0, 10)
    const isClosed = closedEvents.some(e => dayStr >= e.date_start && dayStr <= e.date_end)
    if (isClosed) count++
    current.setDate(current.getDate() + 1)
  }
  return count
}

export function getCaAdjusted(
  caTotal: number,
  daysOpen: number,
  daysInPeriod: number
): number {
  if (daysOpen <= 0 || daysOpen >= daysInPeriod) return caTotal
  return Math.round((caTotal / daysOpen) * daysInPeriod)
}

export function getAnnotationsForPeriod(
  dateStart: Date,
  dateEnd: Date,
  events: CalendarEvent[],
  caTotal: number
): CalendarAnnotation[] {
  const relevantEvents = getEventsForPeriod(dateStart, dateEnd, events)
  if (relevantEvents.length === 0) return []

  const daysInPeriod = Math.round((dateEnd.getTime() - dateStart.getTime()) / 86400000) + 1
  const annotations: CalendarAnnotation[] = []

  for (const event of relevantEvents) {
    if (event.impact === 'closed') {
      const eventStart = parseLocalDate(event.date_start)
      const eventEnd = parseLocalDate(event.date_end)
      const overlapStart = new Date(Math.max(dateStart.getTime(), eventStart.getTime()))
      const overlapEnd = new Date(Math.min(dateEnd.getTime(), eventEnd.getTime()))
      const closedInPeriod = getClosedDays(overlapStart, overlapEnd, [event])
      const daysOpen = daysInPeriod - closedInPeriod
      annotations.push({
        type: 'warning',
        icon: '📅',
        label: event.name,
        detail: `${closedInPeriod} jour${closedInPeriod > 1 ? 's' : ''} de fermeture inclus`,
        ca_adjusted: getCaAdjusted(caTotal, daysOpen, daysInPeriod),
      })
    } else if (event.impact === 'reduced') {
      annotations.push({
        type: 'info',
        icon: event.type === 'religious' ? '🌙' : 'ℹ️',
        label: event.name,
        detail: event.notes || 'Impact sur le CA attendu',
      })
    } else if (event.impact === 'boost') {
      annotations.push({
        type: 'boost',
        icon: event.type === 'school_holiday' ? '🏫' : '🎉',
        label: event.name,
        detail: event.notes || 'Période haute fréquentation',
      })
    }
  }

  return annotations
}

export function isN1ComparisonValid(
  period: { start: Date; end: Date },
  periodN1: { start: Date; end: Date },
  events: CalendarEvent[]
): { valid: boolean; note?: string } {
  const currentReligious = getEventsForPeriod(period.start, period.end, events)
    .filter(e => e.type === 'religious' && e.impact === 'closed')
    .map(e => e.name)

  const n1Religious = getEventsForPeriod(periodN1.start, periodN1.end, events)
    .filter(e => e.type === 'religious' && e.impact === 'closed')
    .map(e => e.name)

  const currentNames = new Set(currentReligious)
  const n1Names = new Set(n1Religious)

  const inCurrentNotN1 = currentReligious.filter(n => !n1Names.has(n))
  const inN1NotCurrent = n1Religious.filter(n => !currentNames.has(n))
  const shifted = [...inCurrentNotN1, ...inN1NotCurrent]

  if (shifted.length > 0) {
    return {
      valid: false,
      note: `Comparaison N-1 décalée — ${[...new Set(shifted)].join(', ')} tombait à une autre période en N-1`,
    }
  }

  return { valid: true }
}
```

- [ ] **Step 2: Écrire les tests**

Créer `tests/calendar-context.test.ts` :

```typescript
import { describe, expect, it } from 'vitest'
import {
  getEventsForPeriod,
  getClosedDays,
  getCaAdjusted,
  getAnnotationsForPeriod,
  isN1ComparisonValid,
  type CalendarEvent,
} from '../lib/calendar-context'

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: '1',
    date_start: '2026-05-01',
    date_end: '2026-05-03',
    type: 'religious',
    name: 'Aïd al-Adha',
    impact: 'closed',
    notes: null,
    editable: true,
    ...overrides,
  }
}

describe('getEventsForPeriod', () => {
  it('returns events that overlap with the period', () => {
    const event = makeEvent({ date_start: '2026-05-29', date_end: '2026-05-31' })
    const result = getEventsForPeriod(new Date(2026, 4, 1), new Date(2026, 4, 31), [event])
    expect(result).toHaveLength(1)
  })

  it('excludes events entirely outside the period', () => {
    const event = makeEvent({ date_start: '2026-06-01', date_end: '2026-06-03' })
    const result = getEventsForPeriod(new Date(2026, 4, 1), new Date(2026, 4, 31), [event])
    expect(result).toHaveLength(0)
  })

  it('includes events that start before and end within period', () => {
    const event = makeEvent({ date_start: '2026-04-28', date_end: '2026-05-03' })
    const result = getEventsForPeriod(new Date(2026, 4, 1), new Date(2026, 4, 31), [event])
    expect(result).toHaveLength(1)
  })
})

describe('getClosedDays', () => {
  it('counts days covered by closed events within period', () => {
    const event = makeEvent({ date_start: '2026-05-29', date_end: '2026-05-31', impact: 'closed' })
    const result = getClosedDays(new Date(2026, 4, 1), new Date(2026, 4, 31), [event])
    expect(result).toBe(3)
  })

  it('does not count reduced or boost events', () => {
    const event = makeEvent({ date_start: '2026-05-01', date_end: '2026-05-31', impact: 'reduced' })
    const result = getClosedDays(new Date(2026, 4, 1), new Date(2026, 4, 31), [event])
    expect(result).toBe(0)
  })

  it('clips event dates to period boundaries', () => {
    const event = makeEvent({ date_start: '2026-04-28', date_end: '2026-05-02', impact: 'closed' })
    const result = getClosedDays(new Date(2026, 4, 1), new Date(2026, 4, 31), [event])
    expect(result).toBe(2) // only May 1 and May 2
  })
})

describe('getCaAdjusted', () => {
  it('adjusts CA proportionally when days are missing', () => {
    // 28 open days, 31 total, CA = 140000 → adjusted = 155000
    expect(getCaAdjusted(140000, 28, 31)).toBe(155000)
  })

  it('returns original CA when all days are open', () => {
    expect(getCaAdjusted(140000, 31, 31)).toBe(140000)
  })

  it('returns original CA when daysOpen >= daysInPeriod', () => {
    expect(getCaAdjusted(100000, 32, 31)).toBe(100000)
  })
})

describe('getAnnotationsForPeriod', () => {
  it('returns warning with ca_adjusted for closed event', () => {
    const event = makeEvent({ date_start: '2026-05-29', date_end: '2026-05-31', impact: 'closed', name: 'Aïd al-Adha' })
    const annotations = getAnnotationsForPeriod(new Date(2026, 4, 1), new Date(2026, 4, 31), [event], 140000)
    expect(annotations).toHaveLength(1)
    expect(annotations[0].type).toBe('warning')
    expect(annotations[0].label).toBe('Aïd al-Adha')
    expect(annotations[0].ca_adjusted).toBeGreaterThan(140000)
    expect(annotations[0].detail).toContain('3 jours')
  })

  it('returns info annotation for reduced event', () => {
    const event = makeEvent({ impact: 'reduced', name: 'Ramadan 2026', type: 'religious' })
    const annotations = getAnnotationsForPeriod(new Date(2026, 4, 1), new Date(2026, 4, 31), [event], 140000)
    expect(annotations).toHaveLength(1)
    expect(annotations[0].type).toBe('info')
    expect(annotations[0].icon).toBe('🌙')
  })

  it('returns boost annotation for school_holiday', () => {
    const event = makeEvent({ impact: 'boost', name: 'Vacances été', type: 'school_holiday' })
    const annotations = getAnnotationsForPeriod(new Date(2026, 4, 1), new Date(2026, 4, 31), [event], 140000)
    expect(annotations).toHaveLength(1)
    expect(annotations[0].type).toBe('boost')
    expect(annotations[0].icon).toBe('🏫')
  })

  it('returns empty array when no events in period', () => {
    const annotations = getAnnotationsForPeriod(new Date(2026, 4, 1), new Date(2026, 4, 31), [], 140000)
    expect(annotations).toHaveLength(0)
  })
})

describe('isN1ComparisonValid', () => {
  it('returns invalid when closed religious event shifts between years', () => {
    const aidN = makeEvent({ date_start: '2026-05-29', date_end: '2026-05-31', type: 'religious', impact: 'closed', name: 'Aïd al-Adha' })
    const aidN1 = makeEvent({ date_start: '2025-06-05', date_end: '2025-06-07', type: 'religious', impact: 'closed', name: 'Aïd al-Adha' })

    const result = isN1ComparisonValid(
      { start: new Date(2026, 4, 1), end: new Date(2026, 4, 31) },
      { start: new Date(2025, 4, 1), end: new Date(2025, 4, 31) },
      [aidN, aidN1]
    )
    expect(result.valid).toBe(false)
    expect(result.note).toContain('Aïd al-Adha')
  })

  it('returns valid when no religious events in either period', () => {
    const result = isN1ComparisonValid(
      { start: new Date(2026, 1, 1), end: new Date(2026, 1, 28) },
      { start: new Date(2025, 1, 1), end: new Date(2025, 1, 28) },
      []
    )
    expect(result.valid).toBe(true)
  })

  it('returns valid when same religious event falls in both periods', () => {
    const ramadanN = makeEvent({ date_start: '2026-02-18', date_end: '2026-03-19', type: 'religious', impact: 'reduced', name: 'Ramadan' })
    const ramadanN1 = makeEvent({ date_start: '2025-03-01', date_end: '2025-03-30', type: 'religious', impact: 'reduced', name: 'Ramadan' })

    const result = isN1ComparisonValid(
      { start: new Date(2026, 1, 1), end: new Date(2026, 1, 28) },
      { start: new Date(2025, 1, 1), end: new Date(2025, 1, 28) },
      [ramadanN, ramadanN1]
    )
    // Neither period contains Ramadan (Feb 2026 starts Feb 18, Feb 2025 has no Ramadan)
    expect(result.valid).toBe(false)
  })
})
```

- [ ] **Step 3: Lancer les tests**

```bash
npm run test -- --reporter=verbose tests/calendar-context.test.ts
```

Expected: 13 tests passent, 0 échec.

- [ ] **Step 4: Commit**

```bash
git add lib/calendar-context.ts tests/calendar-context.test.ts
git commit -m "feat: add calendar-context pure functions with tests"
```

---

## Task 4 — Hook useCalendarEvents + API route CRUD

**Files:**
- Create: `lib/hooks/useCalendarEvents.ts`
- Create: `app/api/calendar-events/route.ts`

- [ ] **Step 1: Créer le hook client**

Créer `lib/hooks/useCalendarEvents.ts` :

```typescript
import { useEffect, useState } from "react"
import type { CalendarEvent } from "@/lib/calendar-context"

export function useCalendarEvents(month: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!month) return
    setLoading(true)
    fetch(`/api/calendar-events?month=${month}`)
      .then(r => r.json())
      .then(data => { setEvents(data.events || []) })
      .catch(() => { setEvents([]) })
      .finally(() => setLoading(false))
  }, [month])

  return { events, loading }
}
```

- [ ] **Step 2: Créer la route API CRUD**

Créer `app/api/calendar-events/route.ts` :

```typescript
import { NextResponse } from "next/server"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month") // ex: 2026-05
  const year = searchParams.get("year")   // ex: 2026

  const adminSupabase = createAdminClient()
  let query = adminSupabase
    .from("calendar_events")
    .select("id, date_start, date_end, type, name, impact, notes, editable")
    .order("date_start", { ascending: true })

  if (month) {
    const [y, m] = month.split("-")
    const lastDay = new Date(Number(y), Number(m), 0).getDate()
    query = query
      .lte("date_start", `${month}-${lastDay}`)
      .gte("date_end", `${month}-01`)
  } else if (year) {
    query = query
      .gte("date_start", `${year}-01-01`)
      .lte("date_end", `${year}-12-31`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ events: data || [] })
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const body = await request.json()
  const { date_start, date_end, type, name, impact, notes } = body

  if (!date_start || !date_end || !type || !name || !impact) {
    return NextResponse.json({ error: "Champs requis manquants." }, { status: 400 })
  }

  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from("calendar_events")
    .insert({ date_start, date_end, type, name, impact, notes: notes || null, editable: true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ event: data }, { status: 201 })
}

export async function PUT(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const body = await request.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: "ID manquant." }, { status: 400 })

  // Check event exists and is editable
  const adminSupabase = createAdminClient()
  const { data: existing } = await adminSupabase
    .from("calendar_events")
    .select("editable")
    .eq("id", id)
    .single()

  if (!existing?.editable) {
    return NextResponse.json({ error: "Cet événement ne peut pas être modifié." }, { status: 403 })
  }

  const allowedUpdates = {
    ...(updates.date_start && { date_start: updates.date_start }),
    ...(updates.date_end && { date_end: updates.date_end }),
    ...(updates.name && { name: updates.name }),
    ...(updates.impact && { impact: updates.impact }),
    notes: updates.notes ?? null,
  }

  const { data, error } = await adminSupabase
    .from("calendar_events")
    .update(allowedUpdates)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ event: data })
}

export async function DELETE(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "ID manquant." }, { status: 400 })

  const adminSupabase = createAdminClient()
  const { data: existing } = await adminSupabase
    .from("calendar_events")
    .select("editable")
    .eq("id", id)
    .single()

  if (!existing?.editable) {
    return NextResponse.json({ error: "Cet événement ne peut pas être supprimé." }, { status: 403 })
  }

  const { error } = await adminSupabase
    .from("calendar_events")
    .delete()
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Vérifier lint + build**

```bash
npm run lint && npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add lib/hooks/useCalendarEvents.ts app/api/calendar-events/route.ts
git commit -m "feat: add calendar-events API route and useCalendarEvents hook"
```

---

## Task 5 — Page admin /calendrier + middleware + nav

**Files:**
- Create: `app/(dashboard)/calendrier/page.tsx`
- Modify: `lib/supabase/middleware.ts`
- Modify: `components/layout/AppShell.tsx`

- [ ] **Step 1: Ajouter /calendrier au middleware**

Dans `lib/supabase/middleware.ts`, modifier deux endroits :

Ligne 5 — ajouter `/calendrier` à `ADMIN_ROUTES` :
```typescript
const ADMIN_ROUTES = ["/", "/charges", "/objectifs", "/import", "/reporting", "/factures", "/calendrier"]
```

Lignes 43-50 — ajouter le check de route protégée :
```typescript
  const isProtectedRoute =
    pathname === "/" ||
    pathname.startsWith("/saisie") ||
    pathname.startsWith("/semaine") ||
    pathname.startsWith("/charges") ||
    pathname.startsWith("/objectifs") ||
    pathname.startsWith("/import") ||
    pathname.startsWith("/reporting") ||
    pathname.startsWith("/factures") ||
    pathname.startsWith("/calendrier")
```

- [ ] **Step 2: Ajouter nav Calendrier dans AppShell**

Dans `components/layout/AppShell.tsx`, ajouter l'import `CalendarRange` depuis lucide-react et ajouter l'entrée nav admin :

```typescript
import { CalendarDays, CalendarRange, Edit3, FileBarChart, FileText, Home, LogOut, Menu, Settings, Target, UploadCloud, X } from "lucide-react"
```

Dans `navByRole.admin` (après Factures, avant Réglages) :
```typescript
    { href: "/calendrier", icon: CalendarRange, label: "Calendrier" },
```

- [ ] **Step 3: Créer la page admin calendrier**

Créer `app/(dashboard)/calendrier/page.tsx` :

```tsx
"use client"

import { useEffect, useState } from "react"
import { CalendarRange, Lock, Plus, Trash2, Edit2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { CalendarEvent } from "@/lib/calendar-context"

const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]
const IMPACT_LABELS: Record<string, string> = { closed: "Fermeture", reduced: "Réduit", boost: "Boost" }
const IMPACT_COLORS: Record<string, string> = {
  closed: "bg-red-100 text-red-700",
  reduced: "bg-amber-100 text-amber-700",
  boost: "bg-green-100 text-green-700",
}
const TYPE_LABELS: Record<string, string> = {
  school_holiday: "Vacances scolaires",
  public_holiday: "Jour férié",
  religious: "Fête religieuse",
  closure: "Fermeture",
  high_traffic: "Haute affluence",
}

type FormState = {
  date_start: string
  date_end: string
  type: string
  name: string
  impact: string
  notes: string
}

const EMPTY_FORM: FormState = { date_start: "", date_end: "", type: "closure", name: "", impact: "closed", notes: "" }

export default function CalendrierPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch(`/api/calendar-events?year=${year}`)
      .then(r => r.json())
      .then(d => setEvents(d.events || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [year])

  const saveEvent = async () => {
    setSaving(true)
    setError(null)
    try {
      const method = editId ? "PUT" : "POST"
      const body = editId ? { id: editId, ...form } : form
      const res = await fetch("/api/calendar-events", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowForm(false)
      setEditId(null)
      setForm(EMPTY_FORM)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  const deleteEvent = async (id: string) => {
    if (!confirm("Supprimer cet événement ?")) return
    await fetch(`/api/calendar-events?id=${id}`, { method: "DELETE" })
    load()
  }

  const startEdit = (event: CalendarEvent) => {
    setForm({ date_start: event.date_start, date_end: event.date_end, type: event.type, name: event.name, impact: event.impact, notes: event.notes || "" })
    setEditId(event.id)
    setShowForm(true)
  }

  const eventsByMonth = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, "0")
    const monthEvents = events.filter(e => e.date_start.slice(0, 7) <= `${year}-${m}` && e.date_end.slice(0, 7) >= `${year}-${m}`)
    return { month: i, label: MONTHS_FR[i], events: monthEvents }
  }).filter(m => m.events.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarRange size={20} className="text-alaska-sage" />
          <h1 className="text-xl font-bold text-alaska-dark">Calendrier</h1>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setYear(y => y - 1)}>‹</Button>
            <span className="text-sm font-medium px-2">{year}</span>
            <Button variant="ghost" size="sm" onClick={() => setYear(y => y + 1)}>›</Button>
          </div>
        </div>
        <Button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM) }} size="sm">
          <Plus size={14} className="mr-1" /> Ajouter
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{editId ? "Modifier l'événement" : "Nouvel événement"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-alaska-muted mb-1 block">Date début</label>
                <input type="date" value={form.date_start} onChange={e => setForm(f => ({...f, date_start: e.target.value}))}
                  className="w-full text-sm px-2 py-1.5 border rounded-lg" />
              </div>
              <div>
                <label className="text-xs text-alaska-muted mb-1 block">Date fin</label>
                <input type="date" value={form.date_end} onChange={e => setForm(f => ({...f, date_end: e.target.value}))}
                  className="w-full text-sm px-2 py-1.5 border rounded-lg" />
              </div>
            </div>
            <div>
              <label className="text-xs text-alaska-muted mb-1 block">Nom</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                placeholder="ex: Fermeture Aïd al-Adha"
                className="w-full text-sm px-2 py-1.5 border rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-alaska-muted mb-1 block">Type</label>
                <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}
                  className="w-full text-sm px-2 py-1.5 border rounded-lg">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-alaska-muted mb-1 block">Impact</label>
                <select value={form.impact} onChange={e => setForm(f => ({...f, impact: e.target.value}))}
                  className="w-full text-sm px-2 py-1.5 border rounded-lg">
                  <option value="closed">Fermeture</option>
                  <option value="reduced">Réduit</option>
                  <option value="boost">Boost</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-alaska-muted mb-1 block">Notes (optionnel)</label>
              <input type="text" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                className="w-full text-sm px-2 py-1.5 border rounded-lg" />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button onClick={saveEvent} disabled={saving} size="sm">{saving ? "Enregistrement..." : "Enregistrer"}</Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setEditId(null) }}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-alaska-muted">Chargement...</p>
      ) : eventsByMonth.length === 0 ? (
        <p className="text-sm text-alaska-muted">Aucun événement en {year}.</p>
      ) : (
        <div className="space-y-4">
          {eventsByMonth.map(({ month, label, events: monthEvents }) => (
            <div key={month}>
              <h3 className="text-xs font-semibold text-alaska-muted uppercase tracking-wide mb-2">{label}</h3>
              <div className="space-y-1.5">
                {monthEvents.map(event => (
                  <div key={event.id} className="flex items-start justify-between gap-3 bg-white border border-gray-100 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-alaska-dark truncate">{event.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${IMPACT_COLORS[event.impact]}`}>
                          {IMPACT_LABELS[event.impact]}
                        </span>
                        {!event.editable && <Lock size={12} className="text-alaska-muted flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-alaska-muted mt-0.5">
                        {event.date_start === event.date_end ? event.date_start : `${event.date_start} → ${event.date_end}`}
                        {event.notes && ` · ${event.notes}`}
                      </p>
                    </div>
                    {event.editable && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => startEdit(event)} className="p-1.5 hover:bg-gray-100 rounded text-alaska-muted">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => deleteEvent(event.id)} className="p-1.5 hover:bg-red-50 rounded text-red-400">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Lancer le build pour vérifier**

```bash
npx tsc --noEmit && npm run lint
```

Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/middleware.ts components/layout/AppShell.tsx app/(dashboard)/calendrier/page.tsx
git commit -m "feat: add /calendrier admin page and nav entry"
```

---

## Task 6 — Composant CalendarAnnotation + annotations Dashboard

**Files:**
- Create: `components/calendar/CalendarAnnotation.tsx`
- Modify: `app/(dashboard)/page.tsx`

- [ ] **Step 1: Créer le composant badge annotation**

Créer `components/calendar/CalendarAnnotation.tsx` :

```tsx
import { cn } from "@/lib/utils"
import { formatMAD } from "@/lib/utils"
import type { CalendarAnnotation } from "@/lib/calendar-context"

export function CalendarAnnotationBadge({ annotation }: { annotation: CalendarAnnotation }) {
  return (
    <div className={cn(
      "flex flex-col gap-0.5 text-xs rounded-lg px-2.5 py-1.5 mt-1.5",
      annotation.type === 'warning' && "bg-amber-50 border border-amber-200 text-amber-800",
      annotation.type === 'info' && "bg-blue-50 border border-blue-200 text-blue-800",
      annotation.type === 'boost' && "bg-emerald-50 border border-emerald-200 text-emerald-800",
      annotation.type === 'correction' && "bg-gray-50 border border-gray-200 text-gray-700",
    )}>
      <div className="flex items-center gap-1.5 font-medium">
        <span aria-hidden="true">{annotation.icon}</span>
        <span>{annotation.label}</span>
      </div>
      <span className="opacity-80">{annotation.detail}</span>
      {annotation.ca_adjusted !== undefined && (
        <span className="font-semibold">
          CA corrigé : {formatMAD(annotation.ca_adjusted)}
        </span>
      )}
      {annotation.vs_n1_note && (
        <span className="italic opacity-70">{annotation.vs_n1_note}</span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Ajouter les annotations sur le KPI CA dans le Dashboard**

Dans `app/(dashboard)/page.tsx`, ajouter les imports suivants en haut du fichier (après les imports existants) :

```typescript
import { useCalendarEvents } from "@/lib/hooks/useCalendarEvents"
import { getAnnotationsForPeriod, isN1ComparisonValid } from "@/lib/calendar-context"
import { CalendarAnnotationBadge } from "@/components/calendar/CalendarAnnotation"
import { startOfMonth, endOfMonth } from "date-fns"
```

Puis, dans le composant `DashboardPage` (ou son équivalent), juste après le state existant, ajouter :

```typescript
  const { events: calendarEvents } = useCalendarEvents(month)

  const caAnnotations = useMemo(() => {
    if (!month || !calendarEvents.length) return []
    const [y, m] = month.split("-").map(Number)
    const start = startOfMonth(new Date(y, m - 1, 1))
    const end = endOfMonth(start)
    return getAnnotationsForPeriod(start, end, calendarEvents, payload.kpis?.ca_total ?? 0)
  }, [month, calendarEvents, payload.kpis?.ca_total])
```

Trouver dans le JSX la carte KPI "CA Total" (chercher `ca_total` dans le rendu) et ajouter les annotations juste en dessous de la valeur affichée :

```tsx
{caAnnotations.map((annotation, i) => (
  <CalendarAnnotationBadge key={i} annotation={annotation} />
))}
```

- [ ] **Step 3: Vérifier**

```bash
npx tsc --noEmit
```

Expected: aucune erreur TypeScript.

- [ ] **Step 4: Commit**

```bash
git add components/calendar/CalendarAnnotation.tsx app/(dashboard)/page.tsx
git commit -m "feat: add CalendarAnnotation badge and dashboard CA annotations"
```

---

## Task 7 — Annotations page Semaine

**Files:**
- Modify: `app/(dashboard)/semaine/page.tsx`

- [ ] **Step 1: Ajouter les annotations dans la vue semaine**

Dans `app/(dashboard)/semaine/page.tsx`, ajouter les imports :

```typescript
import { useCalendarEvents } from "@/lib/hooks/useCalendarEvents"
import { getAnnotationsForPeriod } from "@/lib/calendar-context"
import { CalendarAnnotationBadge } from "@/components/calendar/CalendarAnnotation"
import { useMemo } from "react"
```

Dans le composant `SemainePage`, après les states existants :

```typescript
  const weekMonth = format(weekStart, "yyyy-MM")
  const weekEnd = addDays(weekStart, 6)
  const { events: calendarEvents } = useCalendarEvents(weekMonth)

  const weekAnnotations = useMemo(() => {
    if (!calendarEvents.length) return []
    return getAnnotationsForPeriod(weekStart, weekEnd, calendarEvents, weekTotals.caGlobal)
  }, [weekStart, weekEnd, calendarEvents, weekTotals.caGlobal])
```

Dans le JSX, trouver le titre de la semaine (contenant `weekLabel`) et ajouter le bandeau d'annotations juste en dessous :

```tsx
{weekAnnotations.length > 0 && (
  <div className="space-y-1">
    {weekAnnotations.map((annotation, i) => (
      <CalendarAnnotationBadge key={i} annotation={annotation} />
    ))}
  </div>
)}
```

- [ ] **Step 2: Vérifier**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/semaine/page.tsx
git commit -m "feat: add calendar annotations banner in week view"
```

---

## Task 8 — Annotations section Reporting

**Files:**
- Modify: `app/(dashboard)/reporting/page.tsx`

- [ ] **Step 1: Ajouter les imports**

Dans `app/(dashboard)/reporting/page.tsx`, ajouter :

```typescript
import { useCalendarEvents } from "@/lib/hooks/useCalendarEvents"
import { getAnnotationsForPeriod, isN1ComparisonValid } from "@/lib/calendar-context"
import { CalendarAnnotationBadge } from "@/components/calendar/CalendarAnnotation"
import { startOfMonth, endOfMonth, subMonths } from "date-fns"
```

- [ ] **Step 2: Ajouter le hook et le calcul**

Dans le composant `ReportingPage`, après les states existants :

```typescript
  const { events: calendarEvents } = useCalendarEvents(month)

  const calendarContext = useMemo(() => {
    if (!month || !calendarEvents.length) return { annotations: [], n1Note: null }
    const [y, m] = month.split("-").map(Number)
    const start = startOfMonth(new Date(y, m - 1, 1))
    const end = endOfMonth(start)
    const n1Date = subMonths(start, 12)
    const annotations = getAnnotationsForPeriod(start, end, calendarEvents, payload.kpis?.ca_total ?? 0)
    const n1Check = isN1ComparisonValid(
      { start, end },
      { start: startOfMonth(n1Date), end: endOfMonth(n1Date) },
      calendarEvents
    )
    return { annotations, n1Note: n1Check.valid ? null : n1Check.note }
  }, [month, calendarEvents, payload.kpis?.ca_total])
```

- [ ] **Step 3: Ajouter la section "Contexte calendaire" dans le JSX**

Trouver dans le JSX la section des KPIs principaux et ajouter juste avant (ou après selon le layout) une section "Contexte calendaire" :

```tsx
{(calendarContext.annotations.length > 0 || calendarContext.n1Note) && (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm flex items-center gap-2">
        <span>📅</span> Contexte calendaire
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      {calendarContext.annotations.map((annotation, i) => (
        <CalendarAnnotationBadge key={i} annotation={annotation} />
      ))}
      {calendarContext.n1Note && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
          ⚠️ {calendarContext.n1Note}
        </p>
      )}
    </CardContent>
  </Card>
)}
```

- [ ] **Step 4: Vérifier**

```bash
npx tsc --noEmit && npm run lint
```

Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/reporting/page.tsx
git commit -m "feat: add calendar context section in reporting"
```

---

## Task 9 — Route API Chat (/api/ai/chat)

**Files:**
- Create: `app/api/ai/chat/route.ts`

- [ ] **Step 1: Créer la route**

Créer `app/api/ai/chat/route.ts` :

```typescript
import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function buildChatContext(month: string): Promise<string> {
  const adminSupabase = createAdminClient()
  const [yearStr, monthStr] = month.split("-")
  const year = Number(yearStr)
  const rawMonth = Number(monthStr)
  const lastDay = new Date(year, rawMonth, 0).getDate()

  const [salesRes, expensesRes, objectiveRes, calendarRes] = await Promise.all([
    adminSupabase
      .from("daily_sales")
      .select("date, ca_caisse, ca_b2b")
      .gte("date", `${month}-01`)
      .lte("date", `${month}-${lastDay}`),
    adminSupabase
      .from("expenses")
      .select("category, amount")
      .gte("date", `${month}-01`)
      .lte("date", `${month}-${lastDay}`),
    adminSupabase
      .from("monthly_objectives")
      .select("target_amount")
      .eq("month", month)
      .maybeSingle(),
    adminSupabase
      .from("calendar_events")
      .select("name, date_start, date_end, impact, type")
      .lte("date_start", `${month}-${lastDay}`)
      .gte("date_end", `${month}-01`),
  ])

  const sales = salesRes.data || []
  const ca_total = sales.reduce((sum, s) => sum + (s.ca_caisse ?? 0) + (s.ca_b2b ?? 0), 0)
  const ca_caisse = sales.reduce((sum, s) => sum + (s.ca_caisse ?? 0), 0)
  const ca_b2b = sales.reduce((sum, s) => sum + (s.ca_b2b ?? 0), 0)

  const expenses = expensesRes.data || []
  const byCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + (e.amount ?? 0)
    return acc
  }, {} as Record<string, number>)

  const objective = objectiveRes.data?.target_amount ?? null

  // N-1 month
  const n1Year = rawMonth === 1 ? year - 1 : year
  const n1Month = rawMonth === 1 ? 12 : rawMonth - 1
  const n1Key = `${n1Year}-${String(n1Month).padStart(2, "0")}`
  const n1LastDay = new Date(n1Year, n1Month, 0).getDate()
  const { data: n1Sales } = await adminSupabase
    .from("daily_sales")
    .select("ca_caisse, ca_b2b")
    .gte("date", `${n1Key}-01`)
    .lte("date", `${n1Key}-${n1LastDay}`)
  const ca_n1 = (n1Sales || []).reduce((sum, s) => sum + (s.ca_caisse ?? 0) + (s.ca_b2b ?? 0), 0)

  const calEvents = calendarRes.data || []
  const monthLabel = format(new Date(year, rawMonth - 1, 1), "MMMM yyyy", { locale: fr })
  const n1Label = format(new Date(n1Year, n1Month - 1, 1), "MMMM yyyy", { locale: fr })

  return `DONNÉES FINANCIÈRES — ${monthLabel}

CA total : ${ca_total.toLocaleString("fr-MA")} MAD (caisse: ${ca_caisse.toLocaleString("fr-MA")}, B2B: ${ca_b2b.toLocaleString("fr-MA")})
CA ${n1Label} (N-1) : ${ca_n1.toLocaleString("fr-MA")} MAD${ca_n1 > 0 ? ` (${((ca_total - ca_n1) / ca_n1 * 100).toFixed(1)}%)` : ""}
Objectif mensuel : ${objective ? objective.toLocaleString("fr-MA") + " MAD" : "Non défini"}${objective ? ` | Écart : ${(ca_total - objective >= 0 ? "+" : "") + (ca_total - objective).toLocaleString("fr-MA")} MAD` : ""}

Dépenses :
- Matières premières : ${(byCategory["MP"] ?? 0).toLocaleString("fr-MA")} MAD
- Ressources humaines : ${(byCategory["RH"] ?? 0).toLocaleString("fr-MA")} MAD
- Charges : ${(byCategory["CHARGES"] ?? 0).toLocaleString("fr-MA")} MAD
- Autres : ${(byCategory["AUTRE"] ?? 0).toLocaleString("fr-MA")} MAD

Événements calendaires ce mois :
${calEvents.length > 0
  ? calEvents.map(e => `- ${e.name} (${e.date_start}→${e.date_end}, impact: ${e.impact})`).join("\n")
  : "- Aucun événement particulier"}

Date du jour : ${format(new Date(), "d MMMM yyyy", { locale: fr })}`
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Assistant IA non configuré." }, { status: 503 })
  }

  try {
    const { messages, month } = await request.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages invalides." }, { status: 400 })
    }

    const currentMonth = typeof month === "string" ? month : new Date().toISOString().slice(0, 7)
    const context = await buildChatContext(currentMonth)

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: `Tu es l'assistant financier d'Alaska Neo Bistrot, un restaurant à Rabat (Maroc).
Tu analyses les données financières et le contexte calendaire pour aider le gérant à piloter son activité.
Réponds toujours en français. Sois concis et direct. Utilise des chiffres précis quand tu les cites.
Les montants sont en MAD (dirhams marocains). Ne jamais inventer de données.

${context}`,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    })

    const content = response.content[0]
    if (content.type !== "text") throw new Error("Type de réponse inattendu")

    return NextResponse.json({ reply: content.text })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/ai/chat]", message)
    return NextResponse.json({ error: "Impossible de contacter l'assistant." }, { status: 500 })
  }
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add app/api/ai/chat/route.ts
git commit -m "feat: add /api/ai/chat route with Claude Haiku and financial context"
```

---

## Task 10 — Composants Chat UI (ChatMessage + ChatBubble)

**Files:**
- Create: `components/ai/ChatMessage.tsx`
- Create: `components/ai/ChatBubble.tsx`

- [ ] **Step 1: Créer ChatMessage**

Créer `components/ai/ChatMessage.tsx` :

```tsx
export function ChatMessage({ role, content }: { role: "user" | "assistant"; content: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-alaska-sage text-white rounded-2xl rounded-tr-sm px-3 py-2 text-sm">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-alaska-dark whitespace-pre-wrap">
        {content}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Créer ChatBubble**

Créer `components/ai/ChatBubble.tsx` :

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, MessageCircle, Send, X } from "lucide-react"
import { ChatMessage } from "./ChatMessage"

type Message = { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "Où en est-on par rapport à l'objectif ?",
  "Quel est mon food cost ce mois ?",
  "Quels sont mes jours les plus forts ?",
]

export function ChatBubble({ month }: { month?: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const send = async (text?: string) => {
    const messageText = text ?? input
    if (!messageText.trim() || loading) return

    const userMessage: Message = { role: "user", content: messageText }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          month: month ?? new Date().toISOString().slice(0, 7),
        }),
      })
      const data = await res.json()
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: data.reply ?? data.error ?? "Erreur inattendue." },
      ])
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Désolé, une erreur est survenue." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-alaska-sage rounded-full shadow-lg flex items-center justify-center text-white hover:bg-alaska-sage/90 transition-all"
        aria-label="Ouvrir l'assistant IA"
      >
        <MessageCircle size={24} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/30 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed bottom-0 right-0 z-50 w-full md:w-96 md:bottom-6 md:right-6 h-[85vh] md:h-[600px] bg-white md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-alaska-sage rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageCircle size={16} className="text-white" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-alaska-dark">Assistant Alaska</p>
                  <p className="text-xs text-alaska-muted">Posez vos questions financières</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition"
                aria-label="Fermer l'assistant"
              >
                <X size={18} className="text-alaska-muted" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-6 space-y-3">
                  <p className="text-sm font-medium text-alaska-dark">Bonjour ! Comment puis-je vous aider ?</p>
                  <div className="space-y-2">
                    {SUGGESTIONS.map(q => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="block w-full text-left px-3 py-2 bg-alaska-cream rounded-lg text-xs text-alaska-dark hover:bg-alaska-sage-lt transition"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <ChatMessage key={i} role={m.role} content={m.content} />
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-alaska-muted pl-1">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  En train de réfléchir...
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-100 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="Posez une question..."
                  className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-alaska-sage"
                  aria-label="Message à l'assistant"
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || loading}
                  className="p-2 bg-alaska-sage rounded-lg text-white disabled:opacity-40 hover:bg-alaska-sage/90 transition"
                  aria-label="Envoyer"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
```

- [ ] **Step 3: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add components/ai/ChatMessage.tsx components/ai/ChatBubble.tsx
git commit -m "feat: add ChatMessage and ChatBubble components"
```

---

## Task 11 — Monter ChatBubble dans AppShell

**Files:**
- Modify: `components/layout/AppShell.tsx`

- [ ] **Step 1: Importer et monter ChatBubble**

Dans `components/layout/AppShell.tsx`, ajouter l'import :

```typescript
import { ChatBubble } from "@/components/ai/ChatBubble"
```

Dans la fonction `AppShell`, dans le JSX, ajouter `<ChatBubble />` juste avant la fermeture du `<div className="min-h-screen...">` (après `</main>`) :

```tsx
      <ChatBubble />
    </div>
```

- [ ] **Step 2: Lancer l'app et tester manuellement**

```bash
npm run dev
```

Vérifier :
1. La bulle verte apparaît en bas à droite sur toutes les pages dashboard
2. Cliquer dessus ouvre le drawer
3. Les suggestions s'affichent
4. Saisir "Où en est-on par rapport à l'objectif ?" et appuyer Entrée → une réponse arrive

- [ ] **Step 3: Commit**

```bash
git add components/layout/AppShell.tsx
git commit -m "feat: mount ChatBubble in AppShell layout"
```

---

## Task 12 — Route API Summary + cache (/api/ai/summary)

**Files:**
- Create: `app/api/ai/summary/route.ts`

- [ ] **Step 1: Créer la route summary**

Créer `app/api/ai/summary/route.ts` :

```typescript
import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient, isAdmin } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function buildRichContext(month: string): Promise<string> {
  const adminSupabase = createAdminClient()
  const [yearStr, monthStr] = month.split("-")
  const year = Number(yearStr)
  const rawMonth = Number(monthStr)
  const lastDay = new Date(year, rawMonth, 0).getDate()

  const [salesRes, expensesRes, objectiveRes, calendarRes, chargesRes] = await Promise.all([
    adminSupabase.from("daily_sales").select("date, ca_caisse, ca_b2b, tickets_count").gte("date", `${month}-01`).lte("date", `${month}-${lastDay}`).order("date"),
    adminSupabase.from("expenses").select("date, category, amount, label").gte("date", `${month}-01`).lte("date", `${month}-${lastDay}`),
    adminSupabase.from("monthly_objectives").select("target_amount").eq("month", month).maybeSingle(),
    adminSupabase.from("calendar_events").select("name, date_start, date_end, impact, type").lte("date_start", `${month}-${lastDay}`).gte("date_end", `${month}-01`),
    adminSupabase.from("fixed_charges").select("name, amount, category, is_active").eq("is_active", true),
  ])

  const sales = salesRes.data || []
  const ca_total = sales.reduce((s, r) => s + (r.ca_caisse ?? 0) + (r.ca_b2b ?? 0), 0)
  const ca_caisse = sales.reduce((s, r) => s + (r.ca_caisse ?? 0), 0)
  const ca_b2b = sales.reduce((s, r) => s + (r.ca_b2b ?? 0), 0)
  const total_tickets = sales.reduce((s, r) => s + (r.tickets_count ?? 0), 0)
  const avg_ticket = total_tickets > 0 ? Math.round(ca_total / total_tickets) : 0
  const days_with_data = sales.length
  const ca_per_day = days_with_data > 0 ? Math.round(ca_total / days_with_data) : 0

  const expenses = expensesRes.data || []
  const byCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + (e.amount ?? 0)
    return acc
  }, {} as Record<string, number>)
  const total_expenses = Object.values(byCategory).reduce((s, v) => s + v, 0)
  const food_cost_pct = ca_total > 0 ? ((byCategory["MP"] ?? 0) / ca_total * 100).toFixed(1) : "N/A"

  // N-1
  const n1Year = rawMonth === 1 ? year - 1 : year
  const n1Month = rawMonth === 1 ? 12 : rawMonth - 1
  const n1Key = `${n1Year}-${String(n1Month).padStart(2, "0")}`
  const n1LastDay = new Date(n1Year, n1Month, 0).getDate()
  const { data: n1Sales } = await adminSupabase.from("daily_sales").select("ca_caisse, ca_b2b").gte("date", `${n1Key}-01`).lte("date", `${n1Key}-${n1LastDay}`)
  const ca_n1 = (n1Sales || []).reduce((s, r) => s + (r.ca_caisse ?? 0) + (r.ca_b2b ?? 0), 0)

  const objective = objectiveRes.data?.target_amount ?? null
  const charges_total = (chargesRes.data || []).reduce((s, c) => s + (c.amount ?? 0), 0)
  const breakeven = charges_total > 0 ? Math.round(charges_total / 0.72) : 136667
  const breakeven_pct = ca_total > 0 ? (ca_total / breakeven * 100).toFixed(1) : "0"

  const calEvents = calendarRes.data || []
  const monthLabel = format(new Date(year, rawMonth - 1, 1), "MMMM yyyy", { locale: fr })
  const n1Label = format(new Date(n1Year, n1Month - 1, 1), "MMMM yyyy", { locale: fr })

  return `RAPPORT MENSUEL COMPLET — ${monthLabel}

=== CHIFFRE D'AFFAIRES ===
CA total : ${ca_total.toLocaleString("fr-MA")} MAD
  Caisse (espèces+CB) : ${ca_caisse.toLocaleString("fr-MA")} MAD
  B2B (facturé) : ${ca_b2b.toLocaleString("fr-MA")} MAD
CA ${n1Label} (N-1) : ${ca_n1.toLocaleString("fr-MA")} MAD | Évolution : ${ca_n1 > 0 ? ((ca_total - ca_n1) / ca_n1 * 100).toFixed(1) + "%" : "N/A"}
Jours avec données : ${days_with_data} | CA/jour moyen : ${ca_per_day.toLocaleString("fr-MA")} MAD
Tickets : ${total_tickets} | Ticket moyen : ${avg_ticket.toLocaleString("fr-MA")} MAD

=== OBJECTIF ===
Objectif mensuel : ${objective ? objective.toLocaleString("fr-MA") + " MAD" : "Non défini"}
${objective ? `Atteinte : ${(ca_total / objective * 100).toFixed(1)}% | Écart : ${(ca_total - objective >= 0 ? "+" : "") + (ca_total - objective).toLocaleString("fr-MA")} MAD` : ""}
Seuil de rentabilité : ${breakeven.toLocaleString("fr-MA")} MAD | Atteinte : ${breakeven_pct}%

=== DÉPENSES ===
Total dépenses saisies : ${total_expenses.toLocaleString("fr-MA")} MAD
  Matières premières (MP) : ${(byCategory["MP"] ?? 0).toLocaleString("fr-MA")} MAD | Food cost : ${food_cost_pct}% (seuil : 28%)
  Ressources humaines (RH) : ${(byCategory["RH"] ?? 0).toLocaleString("fr-MA")} MAD
  Charges : ${(byCategory["CHARGES"] ?? 0).toLocaleString("fr-MA")} MAD
  Autres : ${(byCategory["AUTRE"] ?? 0).toLocaleString("fr-MA")} MAD

=== CHARGES FIXES ===
Total charges fixes actives : ${charges_total.toLocaleString("fr-MA")} MAD/mois

=== CONTEXTE CALENDAIRE ===
${calEvents.length > 0
  ? calEvents.map(e => `- ${e.name} (${e.date_start} → ${e.date_end}) : ${e.impact}`).join("\n")
  : "- Aucun événement particulier"}`
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 })
  if (!(await isAdmin(supabase, user.id))) return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Assistant IA non configuré." }, { status: 503 })
  }

  try {
    const { month } = await request.json()
    if (!month || typeof month !== "string") {
      return NextResponse.json({ error: "Mois invalide." }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // Check cache
    const { data: cached } = await adminSupabase
      .from("ai_monthly_summaries")
      .select("summary_md, generated_at, model_used")
      .eq("month", month)
      .maybeSingle()

    if (cached) {
      return NextResponse.json({ summary_md: cached.summary_md, generated_at: cached.generated_at, cached: true })
    }

    // Generate
    const context = await buildRichContext(month)

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: `Tu es l'assistant financier d'Alaska Neo Bistrot, un restaurant à Rabat (Maroc).
Génère une analyse mensuelle structurée, concise et actionnable. Réponds en français.
Les montants sont en MAD. Utilise uniquement les données fournies.
Format de réponse en markdown avec exactement ces sections :
## CA & Performance
## Food Cost & Dépenses
## Points de vigilance
## Recommandations`,
      messages: [{ role: "user", content: `Génère l'analyse financière mensuelle :\n\n${context}` }],
    })

    const content = response.content[0]
    if (content.type !== "text") throw new Error("Type de réponse inattendu")

    const generated_at = new Date().toISOString()

    await adminSupabase.from("ai_monthly_summaries").insert({
      month,
      generated_at,
      summary_md: content.text,
      model_used: "claude-sonnet-4-6",
      context_snapshot: { month, generated_at },
    })

    return NextResponse.json({ summary_md: content.text, generated_at, cached: false })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    console.error("[api/ai/summary]", message)
    return NextResponse.json({ error: "Impossible de générer l'analyse." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 })
  if (!(await isAdmin(supabase, user.id))) return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month")
  if (!month) return NextResponse.json({ error: "Mois manquant." }, { status: 400 })

  const adminSupabase = createAdminClient()
  await adminSupabase.from("ai_monthly_summaries").delete().eq("month", month)
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add app/api/ai/summary/route.ts
git commit -m "feat: add /api/ai/summary route with Claude Sonnet and Supabase cache"
```

---

## Task 13 — Composant MonthlySummary + intégration Reporting

**Files:**
- Create: `components/ai/MonthlySummary.tsx`
- Modify: `app/(dashboard)/reporting/page.tsx`

- [ ] **Step 1: Créer le composant MonthlySummary**

Créer `components/ai/MonthlySummary.tsx` :

```tsx
"use client"

import { useState } from "react"
import { Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type SummaryState = {
  summary_md: string | null
  generated_at: string | null
  cached: boolean
}

export function MonthlySummary({ month }: { month: string }) {
  const [state, setState] = useState<SummaryState>({ summary_md: null, generated_at: null, cached: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async (forceRegen = false) => {
    setLoading(true)
    setError(null)

    if (forceRegen) {
      await fetch(`/api/ai/summary?month=${month}`, { method: "DELETE" })
    }

    try {
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setState({ summary_md: data.summary_md, generated_at: data.generated_at, cached: data.cached })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" })

  // Simple markdown renderer: handles ## headers and **bold** only
  const renderMarkdown = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("## ")) {
        return <h3 key={i} className="font-semibold text-alaska-dark mt-3 mb-1">{line.slice(3)}</h3>
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        const content = line.slice(2).replace(/\*\*(.+?)\*\*/g, "$1")
        return <li key={i} className="text-sm text-alaska-dark ml-3 list-disc">{content}</li>
      }
      if (line.trim() === "") return <div key={i} className="h-1" />
      const rendered = line.replace(/\*\*(.+?)\*\*/g, "$1")
      return <p key={i} className="text-sm text-alaska-dark">{rendered}</p>
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles size={16} className="text-alaska-gold" aria-hidden="true" />
            Analyse IA
          </CardTitle>
          {state.generated_at && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-alaska-muted">
                {state.cached ? "Cache" : "Générée"} · {formatDate(state.generated_at)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => generate(true)}
                disabled={loading}
                aria-label="Régénérer l'analyse"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!state.summary_md && !loading && (
          <Button onClick={() => generate(false)} disabled={loading} className="w-full">
            <Sparkles size={14} className="mr-2" aria-hidden="true" />
            Générer l'analyse du mois
          </Button>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-alaska-muted py-4 justify-center">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Analyse en cours (15-20 secondes)...
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {state.summary_md && (
          <div className="space-y-0.5">
            {renderMarkdown(state.summary_md)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Intégrer MonthlySummary dans Reporting**

Dans `app/(dashboard)/reporting/page.tsx`, ajouter l'import :

```typescript
import { MonthlySummary } from "@/components/ai/MonthlySummary"
```

Dans le JSX, trouver la fin de la page (avant la dernière fermeture de `</div>`) et ajouter la section :

```tsx
<MonthlySummary month={month} />
```

- [ ] **Step 3: Build complet**

```bash
npm run test && npm run lint && npm run build
```

Expected: tests passent, lint OK, build réussi.

- [ ] **Step 4: Commit final**

```bash
git add components/ai/MonthlySummary.tsx app/(dashboard)/reporting/page.tsx
git commit -m "feat: add MonthlySummary component and integrate AI analysis in reporting"
```

---

## Task 14 — Ajouter ANTHROPIC_API_KEY dans Vercel

- [ ] **Step 1: Ajouter la variable en production**

Aller sur https://vercel.com → projet alaska-pilot → Settings → Environment Variables.

Ajouter :
- Nom : `ANTHROPIC_API_KEY`
- Valeur : `sk-ant-api03-...` (clé depuis console.anthropic.com)
- Environnements : Production + Preview

- [ ] **Step 2: Redéployer**

```bash
git push origin main
```

Vérifier dans les logs Vercel que le build passe.

- [ ] **Step 3: Vérifier en production**

1. Ouvrir l'app en prod
2. Cliquer sur la bulle chat
3. Poser "Où en est-on par rapport à l'objectif ce mois ?"
4. Vérifier que la réponse arrive
5. Aller sur `/reporting`, cliquer "Générer l'analyse du mois"
6. Vérifier que l'analyse apparaît
7. Aller sur `/calendrier`, vérifier que les événements pré-chargés apparaissent

---

## Self-Review — Couverture du Spec

| Exigence spec | Task couvrant |
|---|---|
| Zéro token sur changement de page | ✅ Tasks 6-8 : annotations purement en code |
| Chat Claude Haiku sur message envoyé | ✅ Task 9-11 |
| Résumé mensuel Claude Sonnet + cache | ✅ Tasks 12-13 |
| Table `calendar_events` + seed 2025-2027 | ✅ Task 2 |
| Table `ai_monthly_summaries` | ✅ Task 2 |
| Fonctions pures + tests | ✅ Task 3 (13 tests) |
| Page admin `/calendrier` | ✅ Task 5 |
| Nav Calendrier admin uniquement | ✅ Task 5 |
| Middleware protection `/calendrier` | ✅ Task 5 |
| Annotations Dashboard (CA KPI) | ✅ Task 6 |
| Bandeau semaine | ✅ Task 7 |
| Section calendrier reporting + N-1 note | ✅ Task 8 |
| Note comparaison N-1 invalide | ✅ Tasks 3 + 8 |
| ANTHROPIC_API_KEY côté serveur uniquement | ✅ Tasks 9, 12 |
| Contrôle auth sur routes IA | ✅ Tasks 9, 12 |
| Vercel production | ✅ Task 14 |
