-- Multi-restaurants : un même compte (owner_id) peut avoir plusieurs restaurants.
-- On supprime la contrainte d'unicité sur owner_id.

DROP INDEX IF EXISTS idx_restaurants_owner;

CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON restaurants(owner_id);

COMMENT ON TABLE restaurants IS 'Plusieurs restaurants par compte (owner_id). Données : nom, activité, couverts, type de service.';
