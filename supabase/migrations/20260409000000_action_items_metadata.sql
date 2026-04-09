-- Migration: Add metadata JSONB column to action_items + seed alcohol license action
-- Date: 2026-04-09

ALTER TABLE action_items
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- Seed alcohol license action item (first in list, sort_order=0)
-- Bump existing items to make room
UPDATE action_items SET sort_order = sort_order + 1
WHERE title != 'Obtenir la licence d''alcool';

INSERT INTO action_items (lever, title, description, priority, deadline, impact, status, sort_order)
VALUES (
  'pilotage',
  'Obtenir la licence d''alcool',
  'Démarches administratives auprès de la Wilaya de Rabat. Tournant majeur : ticket moyen estimé à 250 MAD (+47% vs 170 MAD actuel).',
  'urgent',
  'T3 2026',
  'Ticket moyen 170 → 250 MAD (+47%) · CA annuel projeté +40%',
  'todo',
  0
)
ON CONFLICT DO NOTHING;
