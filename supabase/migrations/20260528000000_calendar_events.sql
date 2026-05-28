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
