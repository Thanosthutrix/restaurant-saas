-- Module Analyse, Anti-Gaspillage & Optimisation Dynamique des Recettes
-- Tables: waste_logs, feedback_question_templates, feedback_user_question_history,
--         anonymous_feedback, supplier_order_anomaly_responses, analysis_reports,
--         analysis_recommendations
-- Recettes: réutilise dishes + dish_components + inventory_items (pas de table recipes dédiée).

-- ---------------------------------------------------------------------------
-- 1) Pertes (WasteLog)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS waste_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL,
  dish_id uuid REFERENCES dishes(id) ON DELETE SET NULL,
  waste_type text NOT NULL,
  reason text NOT NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  estimated_cost_ht numeric,
  notes text,
  stock_movement_id uuid REFERENCES stock_movements(id) ON DELETE SET NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  logged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_waste_logs_type CHECK (waste_type IN ('raw', 'prep', 'plate')),
  CONSTRAINT chk_waste_logs_reason CHECK (reason IN ('dlc', 'cooking', 'dropped', 'quality', 'other')),
  CONSTRAINT chk_waste_logs_qty_positive CHECK (quantity > 0),
  CONSTRAINT chk_waste_logs_unit_non_empty CHECK (length(trim(unit)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_waste_logs_restaurant_logged
  ON waste_logs (restaurant_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_waste_logs_service
  ON waste_logs (service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_waste_logs_item
  ON waste_logs (inventory_item_id) WHERE inventory_item_id IS NOT NULL;

COMMENT ON TABLE waste_logs IS 'Historique des pertes saisies en 2 clics (brute / prépa / assiette).';
COMMENT ON COLUMN waste_logs.waste_type IS 'raw = matière brute, prep = préparation, plate = assiette/plat fini.';
COMMENT ON COLUMN waste_logs.reason IS 'dlc, cooking, dropped, quality, other.';

-- Sortie stock dédiée aux pertes (optionnelle, liée depuis waste_logs.stock_movement_id).
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS chk_stock_movements_movement_type;
ALTER TABLE stock_movements ADD CONSTRAINT chk_stock_movements_movement_type CHECK (
  movement_type IN ('purchase', 'consumption', 'adjustment', 'inventory_count', 'waste')
);

-- ---------------------------------------------------------------------------
-- 2) Templates de questions (QuestionTemplate)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback_question_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  category text NOT NULL,
  prompt_template text NOT NULL,
  response_type text NOT NULL,
  required_variables text[] NOT NULL DEFAULT '{}',
  trigger_conditions jsonb NOT NULL DEFAULT '{}',
  follow_up_config jsonb NOT NULL DEFAULT '{}',
  priority int NOT NULL DEFAULT 50,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_feedback_question_templates_key UNIQUE (template_key),
  CONSTRAINT chk_feedback_question_templates_category CHECK (
    category IN (
      'waste_returns',
      'kitchen_workflow',
      'ingredient_quality',
      'team_moral',
      'event_trigger'
    )
  ),
  CONSTRAINT chk_feedback_question_templates_response_type CHECK (
    response_type IN (
      'yes_no',
      'yes_no_then_dish_component',
      'dish_picker',
      'ingredient_family_picker',
      'equipment_picker',
      'emoji_stress',
      'emoji_rating',
      'text_short'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_feedback_question_templates_category_active
  ON feedback_question_templates (category, is_active) WHERE is_active = true;

COMMENT ON TABLE feedback_question_templates IS
  'Templates de micro-sondages clôture de service. Variables: {dish_name}, {sales_count}, {ingredient_name}, etc.';
COMMENT ON COLUMN feedback_question_templates.trigger_conditions IS
  'JSON: { "min_sales_vs_avg_pct": 15, "new_dish_days_max": 7, "requires_top_seller": true, ... }';
COMMENT ON COLUMN feedback_question_templates.follow_up_config IS
  'JSON: options de suivi si oui (ex. composants assiette: viande, garniture, sauce).';

-- ---------------------------------------------------------------------------
-- 3) Historique cooldown par utilisateur (UserQuestionHistory)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback_user_question_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES feedback_question_templates(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  context_key text NOT NULL DEFAULT 'global',
  shown_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_feedback_user_question_history_cooldown
    UNIQUE (user_id, restaurant_id, template_id, context_key)
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_question_history_user_shown
  ON feedback_user_question_history (user_id, restaurant_id, shown_at DESC);

COMMENT ON TABLE feedback_user_question_history IS
  'Cooldown 14j par combinaison [utilisateur + template + contexte plat/ingrédient]. Pas de réponse stockée ici.';
COMMENT ON COLUMN feedback_user_question_history.context_key IS
  'Ex: global, dish:{uuid}, ingredient:{uuid}. Évite répétition même template sur même plat.';

-- ---------------------------------------------------------------------------
-- 4) Réponses anonymes (AnonymousFeedback) — aucun user_id
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS anonymous_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES feedback_question_templates(id) ON DELETE RESTRICT,
  template_key text NOT NULL,
  category text NOT NULL,
  context_key text NOT NULL DEFAULT 'global',
  response_payload jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anonymous_feedback_restaurant_service
  ON anonymous_feedback (restaurant_id, service_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_anonymous_feedback_category
  ON anonymous_feedback (restaurant_id, category, submitted_at DESC);

COMMENT ON TABLE anonymous_feedback IS
  'Réponses 100% anonymes. Aucune colonne user_id — agrégation stats uniquement.';

-- ---------------------------------------------------------------------------
-- 5) Anomalies commande fournisseur (QCM ajustement vs stock théorique)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_order_anomaly_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_draft_id uuid NOT NULL REFERENCES order_drafts(id) ON DELETE CASCADE,
  order_draft_line_id uuid NOT NULL REFERENCES order_draft_lines(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  anomaly_type text NOT NULL,
  suggested_qty numeric NOT NULL,
  adjusted_qty numeric NOT NULL,
  theoretical_stock_qty numeric NOT NULL,
  explanation_code text NOT NULL,
  explanation_note text,
  responded_by uuid,
  responded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_supplier_order_anomaly_type CHECK (
    anomaly_type IN ('decrease_while_theo_zero', 'increase_while_theo_positive')
  )
);

CREATE INDEX IF NOT EXISTS idx_supplier_order_anomaly_restaurant
  ON supplier_order_anomaly_responses (restaurant_id, responded_at DESC);

COMMENT ON TABLE supplier_order_anomaly_responses IS
  'Explications terrain quand l''utilisateur ajuste une commande fournisseur vs stock théorique.';

-- ---------------------------------------------------------------------------
-- 6) Rapports d''analyse & recommandations (action 1-clic recette)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  deterministic_payload jsonb NOT NULL DEFAULT '{}',
  coach_payload jsonb,
  coach_generated_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_analysis_reports_status CHECK (
    status IN ('draft', 'computing', 'ready', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_analysis_reports_restaurant_period
  ON analysis_reports (restaurant_id, period_end DESC);

CREATE TABLE IF NOT EXISTS analysis_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES analysis_reports(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  recommendation_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  dish_id uuid REFERENCES dishes(id) ON DELETE SET NULL,
  inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL,
  suggested_qty_delta numeric,
  suggested_qty_absolute numeric,
  status text NOT NULL DEFAULT 'pending',
  applied_at timestamptz,
  applied_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_analysis_recommendations_type CHECK (
    recommendation_type IN (
      'reduce_component_qty',
      'increase_component_qty',
      'remove_component',
      'add_component',
      'menu_pricing',
      'operational',
      'other'
    )
  ),
  CONSTRAINT chk_analysis_recommendations_status CHECK (
    status IN ('pending', 'applied', 'dismissed')
  )
);

CREATE INDEX IF NOT EXISTS idx_analysis_recommendations_report
  ON analysis_recommendations (report_id, status);

COMMENT ON TABLE analysis_recommendations IS
  'Recommandations du rapport. reduce_component_qty → apply sur dish_components en 1 clic.';

-- ---------------------------------------------------------------------------
-- 7) Seeds — templates de questions par défaut
-- ---------------------------------------------------------------------------
INSERT INTO feedback_question_templates (
  template_key, category, prompt_template, response_type,
  required_variables, trigger_conditions, follow_up_config, priority
) VALUES
(
  'TOP_SELLER_SETUP',
  'event_trigger',
  'Le {dish_name} a cartonné ce soir ({sales_count} ventes). La mise en place était suffisante ?',
  'yes_no',
  ARRAY['dish_name', 'sales_count'],
  '{"requires_top_seller": true}',
  '{}',
  90
),
(
  'SLOW_SELLER_FEEDBACK',
  'event_trigger',
  'Seulement {sales_count} {dish_name} vendus ce soir. Des retours clients particuliers en salle ?',
  'yes_no',
  ARRAY['dish_name', 'sales_count'],
  '{"requires_slow_seller": true}',
  '{}',
  85
),
(
  'HIGH_FOOD_COST_INGREDIENT',
  'waste_returns',
  'On a utilisé beaucoup de {ingredient_name} ce soir. Tu as remarqué du gâchis ou une découpe difficile ?',
  'yes_no',
  ARRAY['ingredient_name'],
  '{"requires_high_food_cost_ingredient": true}',
  '{}',
  80
),
(
  'PLATE_RETURN_FREQUENT',
  'waste_returns',
  'Avez-vous vu un plat revenir souvent non terminé ce soir ?',
  'yes_no_then_dish_component',
  '{}',
  '{}',
  '{"components": ["viande", "garniture", "sauce", "accompagnement", "autre"]}',
  70
),
(
  'KITCHEN_BOTTLENECK_DISH',
  'kitchen_workflow',
  'Quel plat a provoqué le plus de bouchons / stress en coup de feu ce soir ?',
  'dish_picker',
  '{}',
  '{}',
  '{}',
  75
),
(
  'INGREDIENT_QUALITY_ALERT',
  'ingredient_quality',
  'Un ingrédient t''a semblé de moins bonne qualité / moins frais à la réception ?',
  'ingredient_family_picker',
  '{}',
  '{}',
  '{}',
  65
),
(
  'EQUIPMENT_SLOWDOWN',
  'ingredient_quality',
  'Un appareil ou outil t''a fait perdre du temps ce soir ?',
  'equipment_picker',
  '{}',
  '{}',
  '{"equipment_options": ["four", "friteuse", "plancha", "mixeur", "lave_vaisselle", "autre"]}',
  60
),
(
  'TEAM_STRESS_EMOJI',
  'team_moral',
  'Le niveau de stress du service en un émoji ?',
  'emoji_stress',
  '{}',
  '{}',
  '{"options": [{"value": "hell", "emoji": "🔴", "label": "En enfer"}, {"value": "tense", "emoji": "🟡", "label": "Tendu"}, {"value": "smooth", "emoji": "🟢", "label": "Fluidité"}]}',
  55
),
(
  'HIGH_SALES_SETUP',
  'event_trigger',
  'Gros chiffre ce soir (+{sales_vs_avg_pct}% vs habituel) ! La mise en place a-t-elle tenu le choc ?',
  'yes_no',
  ARRAY['sales_vs_avg_pct'],
  '{"min_sales_vs_avg_pct": 15}',
  '{}',
  95
),
(
  'NEW_DISH_FEEDBACK',
  'event_trigger',
  'Retour terrain sur le nouveau {dish_name} ?',
  'emoji_rating',
  ARRAY['dish_name'],
  '{"new_dish_days_max": 7}',
  '{"options": [{"value": 1, "emoji": "😕"}, {"value": 2, "emoji": "😐"}, {"value": 3, "emoji": "🙂"}, {"value": 4, "emoji": "😍"}]}',
  88
)
ON CONFLICT (template_key) DO NOTHING;
