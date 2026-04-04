-- Évite les doublons (ticket_import_id, line_index) : une seule ligne par position par ticket.
-- 1) Supprime les doublons en gardant la ligne avec le plus petit id par (ticket_import_id, line_index).
DELETE FROM ticket_import_lines a
USING ticket_import_lines b
WHERE a.ticket_import_id = b.ticket_import_id
  AND a.line_index = b.line_index
  AND a.id > b.id;

-- 2) Contrainte unique : empêche les insertions multiples concurrentes.
ALTER TABLE ticket_import_lines
  ADD CONSTRAINT uq_ticket_import_lines_import_index UNIQUE (ticket_import_id, line_index);

COMMENT ON CONSTRAINT uq_ticket_import_lines_import_index ON ticket_import_lines IS 'Une seule ligne par (ticket_import_id, line_index). Rend l''hydratation idempotente.';
