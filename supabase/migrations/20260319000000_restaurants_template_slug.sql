-- Template de restaurant (slug) pour cohérence avec lib/templates/restaurantTemplates.ts.
-- Ne pas écraser les données existantes : activity_type conservé pour rétrocompat.

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS template_slug text;

COMMENT ON COLUMN restaurants.template_slug IS 'Slug du template (pizzeria, snack-fastfood, etc.) pour suggestions. Optionnel.';
