-- Désactiver Poulet des templates journaliers pour éviter le double comptage
-- (Poulet sera saisi mensuellement comme virement fournisseur)
UPDATE expense_item_templates
SET is_active = false
WHERE label = 'Poulet'
  AND section_id = (
    SELECT id FROM expense_sections
    WHERE name = 'Matières Premières'
    LIMIT 1
  );
