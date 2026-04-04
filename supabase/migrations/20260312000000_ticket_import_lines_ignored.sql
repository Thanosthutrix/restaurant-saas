-- Ligne marquée comme "ignorée" par l'utilisateur : ne participe pas aux ventes.
-- Permet de distinguer "non encore associée" et "ignorée volontairement".
ALTER TABLE ticket_import_lines
  ADD COLUMN IF NOT EXISTS ignored boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN ticket_import_lines.ignored IS 'Si true, la ligne est ignorée (ne génère pas de vente). L''utilisateur peut la réactiver.';
