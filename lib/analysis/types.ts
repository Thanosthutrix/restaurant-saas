/** Types partagés — Module Analyse, Anti-Gaspillage & Optimisation Recettes. */

export type FeedbackQuestionCategory =
  | "waste_returns"
  | "kitchen_workflow"
  | "ingredient_quality"
  | "team_moral"
  | "event_trigger";

export type FeedbackResponseType =
  | "yes_no"
  | "yes_no_then_dish_component"
  | "dish_picker"
  | "ingredient_family_picker"
  | "equipment_picker"
  | "emoji_stress"
  | "emoji_rating"
  | "text_short";

export type WasteType = "raw" | "prep" | "plate";
export type WasteReason = "dlc" | "cooking" | "dropped" | "quality" | "other";

export type FeedbackQuestionTemplateRow = {
  id: string;
  template_key: string;
  category: FeedbackQuestionCategory;
  prompt_template: string;
  response_type: FeedbackResponseType;
  required_variables: string[];
  trigger_conditions: Record<string, unknown>;
  follow_up_config: Record<string, unknown>;
  priority: number;
  is_active: boolean;
};

export type ServiceDaySaleRow = {
  dish_id: string;
  dish_name: string;
  qty: number;
  line_total_ht: number | null;
  created_at: string | null;
};

export type ServiceContext = {
  restaurantId: string;
  serviceId: string;
  serviceDate: string;
  serviceType: string;
  totalCovers: number;
  totalSalesQty: number;
  totalRevenueHt: number;
  salesByDish: ServiceDaySaleRow[];
  topSeller: ServiceDaySaleRow | null;
  slowSeller: ServiceDaySaleRow | null;
  salesVsAvgPct: number | null;
  newDishes: { dish_id: string; dish_name: string; days_since_added: number }[];
  highUsageIngredients: {
    inventory_item_id: string;
    ingredient_name: string;
    consumed_qty: number;
    food_cost_ht: number;
  }[];
  menuDishes: { dish_id: string; dish_name: string; image_url: string | null }[];
  ingredientFamilies: { id: string; name: string }[];
};

export type QuestionVariableMap = Record<string, string | number>;

export type ResolvedQuestionCandidate = {
  template: FeedbackQuestionTemplateRow;
  contextKey: string;
  variables: QuestionVariableMap;
  renderedPrompt: string;
  score: number;
  pickerOptions?: {
    dishes?: { id: string; name: string; image_url: string | null }[];
    ingredientFamilies?: { id: string; name: string }[];
    equipment?: { value: string; label: string }[];
    emojiOptions?: { value: string | number; emoji: string; label: string }[];
    plateComponents?: string[];
  };
};

export type SelectedShiftQuestion = {
  step: number;
  templateId: string;
  templateKey: string;
  category: FeedbackQuestionCategory;
  responseType: FeedbackResponseType;
  contextKey: string;
  prompt: string;
  followUpConfig: Record<string, unknown>;
  pickerOptions?: ResolvedQuestionCandidate["pickerOptions"];
};

export type ShiftClosingQuestionSet = {
  serviceId: string;
  questions: SelectedShiftQuestion[];
  expiresAt: string;
};
