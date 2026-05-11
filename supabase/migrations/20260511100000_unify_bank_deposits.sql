-- Recatégoriser toutes les dépenses "Cash" mal classées en MP ou AUTRE
UPDATE expenses
SET category = 'CHARGES', label = 'Virement banque'
WHERE label = 'Cash' AND category IN ('MP', 'AUTRE');

-- Désactiver le template "Cash" dans toutes les sections
UPDATE expense_item_templates
SET is_active = false
WHERE label = 'Cash';

-- S'assurer qu'il existe un template "Virement banque" dans une section CHARGES
INSERT INTO expense_item_templates (id, section_id, label, sort_order, is_active)
SELECT gen_random_uuid(), s.id, 'Virement banque', 99, true
FROM expense_sections s
WHERE s.expense_category = 'CHARGES'
  AND NOT EXISTS (
    SELECT 1 FROM expense_item_templates t
    WHERE t.section_id = s.id AND t.label = 'Virement banque'
  )
LIMIT 1;
