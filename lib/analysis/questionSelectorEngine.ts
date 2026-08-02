/**
 * QuestionSelectorEngine — sélectionne 3 questions contextualisées à la clôture de service.
 *
 * Pipeline:
 * 1. Construire le contexte POS du jour (serviceContextBuilder)
 * 2. Charger les templates actifs
 * 3. Générer les candidats (triggers + variables dynamiques)
 * 4. Filtrer le cooldown 14j par utilisateur
 * 5. Scorer et tirer 1 question par catégorie max, total = 3
 * 6. Retourner le jeu prêt pour ShiftClosingModal
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { buildServiceContext } from "@/lib/analysis/serviceContextBuilder";
import type {
  FeedbackQuestionTemplateRow,
  QuestionVariableMap,
  ResolvedQuestionCandidate,
  SelectedShiftQuestion,
  ShiftClosingQuestionSet,
  ServiceContext,
} from "@/lib/analysis/types";

const COOLDOWN_DAYS = 14;
const QUESTIONS_PER_SHIFT = 3;

const CATEGORY_QUOTAS: Record<string, number> = {
  event_trigger: 1,
  waste_returns: 1,
  kitchen_workflow: 1,
  ingredient_quality: 1,
  team_moral: 1,
};

export async function selectShiftClosingQuestions(params: {
  restaurantId: string;
  serviceId: string;
  userId: string;
}): Promise<{ ok: true; data: ShiftClosingQuestionSet } | { ok: false; error: string }> {
  const context = await buildServiceContext(params.restaurantId, params.serviceId);
  if (!context) {
    return { ok: false, error: "Service introuvable." };
  }

  const templates = await loadActiveTemplates();
  if (templates.length === 0) {
    return { ok: false, error: "Aucun template de question configuré." };
  }

  const cooldownKeys = await loadCooldownKeys(
    params.userId,
    params.restaurantId,
    COOLDOWN_DAYS
  );

  const candidates = generateCandidates(context, templates).filter(
    (c) => !cooldownKeys.has(cooldownKey(c.template.id, c.contextKey))
  );

  const selected = pickBalancedQuestions(candidates, QUESTIONS_PER_SHIFT);

  if (selected.length === 0) {
    return { ok: false, error: "Toutes les questions sont en cooldown pour cet utilisateur." };
  }

  const questions: SelectedShiftQuestion[] = selected.map((c, i) => ({
    step: i + 1,
    templateId: c.template.id,
    templateKey: c.template.template_key,
    category: c.template.category,
    responseType: c.template.response_type,
    contextKey: c.contextKey,
    prompt: c.renderedPrompt,
    followUpConfig: c.template.follow_up_config,
    pickerOptions: c.pickerOptions,
  }));

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  return {
    ok: true,
    data: {
      serviceId: params.serviceId,
      questions,
      expiresAt,
    },
  };
}

/** Enregistre l'affichage pour le cooldown (sans stocker la réponse). */
export async function recordQuestionsShown(params: {
  userId: string;
  restaurantId: string;
  serviceId: string;
  questions: { templateId: string; contextKey: string }[];
}): Promise<void> {
  if (params.questions.length === 0) return;

  const rows = params.questions.map((q) => ({
    user_id: params.userId,
    restaurant_id: params.restaurantId,
    template_id: q.templateId,
    service_id: params.serviceId,
    context_key: q.contextKey,
    shown_at: new Date().toISOString(),
  }));

  await supabaseServer.from("feedback_user_question_history").upsert(rows, {
    onConflict: "user_id,restaurant_id,template_id,context_key",
  });
}

function cooldownKey(templateId: string, contextKey: string): string {
  return `${templateId}::${contextKey}`;
}

async function loadActiveTemplates(): Promise<FeedbackQuestionTemplateRow[]> {
  const { data, error } = await supabaseServer
    .from("feedback_question_templates")
    .select("*")
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (error || !data) return [];
  return data as FeedbackQuestionTemplateRow[];
}

async function loadCooldownKeys(
  userId: string,
  restaurantId: string,
  cooldownDays: number
): Promise<Set<string>> {
  const since = new Date();
  since.setDate(since.getDate() - cooldownDays);

  const { data, error } = await supabaseServer
    .from("feedback_user_question_history")
    .select("template_id, context_key")
    .eq("user_id", userId)
    .eq("restaurant_id", restaurantId)
    .gte("shown_at", since.toISOString());

  if (error || !data) return new Set();

  return new Set(
    data.map((r) => cooldownKey(String(r.template_id), String(r.context_key)))
  );
}

export function generateCandidates(
  context: ServiceContext,
  templates: FeedbackQuestionTemplateRow[]
): ResolvedQuestionCandidate[] {
  const out: ResolvedQuestionCandidate[] = [];

  for (const template of templates) {
    const generated = expandTemplateCandidates(context, template);
    out.push(...generated);
  }

  return out.sort((a, b) => b.score - a.score);
}

function expandTemplateCandidates(
  context: ServiceContext,
  template: FeedbackQuestionTemplateRow
): ResolvedQuestionCandidate[] {
  const triggers = template.trigger_conditions ?? {};

  switch (template.template_key) {
    case "TOP_SELLER_SETUP":
      if (!triggers.requires_top_seller || !context.topSeller) return [];
      return [
        buildCandidate(template, context, `dish:${context.topSeller.dish_id}`, {
          dish_name: context.topSeller.dish_name,
          sales_count: context.topSeller.qty,
        }, template.priority + context.topSeller.qty),
      ];

    case "SLOW_SELLER_FEEDBACK":
      if (!triggers.requires_slow_seller || !context.slowSeller) return [];
      return [
        buildCandidate(template, context, `dish:${context.slowSeller.dish_id}`, {
          dish_name: context.slowSeller.dish_name,
          sales_count: context.slowSeller.qty,
        }, template.priority),
      ];

    case "HIGH_FOOD_COST_INGREDIENT":
      if (!triggers.requires_high_food_cost_ingredient) return [];
      return context.highUsageIngredients.map((ing) =>
        buildCandidate(
          template,
          context,
          `ingredient:${ing.inventory_item_id}`,
          { ingredient_name: ing.ingredient_name },
          template.priority + Math.round(ing.food_cost_ht)
        )
      );

    case "HIGH_SALES_SETUP": {
      const minPct = Number(triggers.min_sales_vs_avg_pct ?? 15);
      if (context.salesVsAvgPct == null || context.salesVsAvgPct < minPct) return [];
      return [
        buildCandidate(template, context, "global", {
          sales_vs_avg_pct: context.salesVsAvgPct,
        }, template.priority + context.salesVsAvgPct),
      ];
    }

    case "NEW_DISH_FEEDBACK": {
      const maxDays = Number(triggers.new_dish_days_max ?? 7);
      const eligible = context.newDishes.filter((d) => d.days_since_added <= maxDays);
      return eligible.map((d) =>
        buildCandidate(
          template,
          context,
          `dish:${d.dish_id}`,
          { dish_name: d.dish_name },
          template.priority + (maxDays - d.days_since_added) * 2
        )
      );
    }

    case "PLATE_RETURN_FREQUENT":
      return [
        buildCandidate(template, context, "global", {}, template.priority, {
          plateComponents: (template.follow_up_config.components as string[]) ?? [],
        }),
      ];

    case "KITCHEN_BOTTLENECK_DISH":
      return [
        buildCandidate(template, context, "global", {}, template.priority, {
          dishes: context.menuDishes.map((d) => ({
            id: d.dish_id,
            name: d.dish_name,
            image_url: d.image_url,
          })),
        }),
      ];

    case "INGREDIENT_QUALITY_ALERT":
      return [
        buildCandidate(template, context, "global", {}, template.priority, {
          ingredientFamilies: context.ingredientFamilies,
        }),
      ];

    case "EQUIPMENT_SLOWDOWN": {
      const equipmentOptions =
        (template.follow_up_config.equipment_options as string[]) ?? [];
      return [
        buildCandidate(template, context, "global", {}, template.priority, {
          equipment: equipmentOptions.map((v) => ({
            value: v,
            label: formatEquipmentLabel(v),
          })),
        }),
      ];
    }

    case "TEAM_STRESS_EMOJI":
      return [
        buildCandidate(template, context, "global", {}, template.priority, {
          emojiOptions:
            (template.follow_up_config.options as {
              value: string;
              emoji: string;
              label: string;
            }[]) ?? [],
        }),
      ];

    default:
      if (Object.keys(triggers).length > 0 && !evaluateGenericTriggers(context, triggers)) {
        return [];
      }
      return [buildCandidate(template, context, "global", {}, template.priority)];
  }
}

function evaluateGenericTriggers(
  context: ServiceContext,
  triggers: Record<string, unknown>
): boolean {
  if (triggers.min_sales_vs_avg_pct != null) {
    const min = Number(triggers.min_sales_vs_avg_pct);
    if (context.salesVsAvgPct == null || context.salesVsAvgPct < min) return false;
  }
  if (triggers.requires_top_seller && !context.topSeller) return false;
  if (triggers.requires_slow_seller && !context.slowSeller) return false;
  return true;
}

function buildCandidate(
  template: FeedbackQuestionTemplateRow,
  context: ServiceContext,
  contextKey: string,
  variables: QuestionVariableMap,
  score: number,
  pickerOptions?: ResolvedQuestionCandidate["pickerOptions"]
): ResolvedQuestionCandidate {
  return {
    template,
    contextKey,
    variables,
    renderedPrompt: renderPrompt(template.prompt_template, variables),
    score,
    pickerOptions: pickerOptions ?? buildDefaultPickerOptions(template, context),
  };
}

function buildDefaultPickerOptions(
  template: FeedbackQuestionTemplateRow,
  context: ServiceContext
): ResolvedQuestionCandidate["pickerOptions"] | undefined {
  if (template.response_type === "dish_picker" || template.response_type === "yes_no_then_dish_component") {
    return {
      dishes: context.menuDishes.map((d) => ({
        id: d.dish_id,
        name: d.dish_name,
        image_url: d.image_url,
      })),
      plateComponents: (template.follow_up_config.components as string[]) ?? undefined,
    };
  }
  if (template.response_type === "ingredient_family_picker") {
    return { ingredientFamilies: context.ingredientFamilies };
  }
  if (template.response_type === "emoji_stress" || template.response_type === "emoji_rating") {
    return {
      emojiOptions:
        (template.follow_up_config.options as {
          value: string | number;
          emoji: string;
          label: string;
        }[]) ?? [],
    };
  }
  return undefined;
}

export function renderPrompt(template: string, variables: QuestionVariableMap): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = variables[key];
    return val != null ? String(val) : `{${key}}`;
  });
}

export function pickBalancedQuestions(
  candidates: ResolvedQuestionCandidate[],
  limit: number
): ResolvedQuestionCandidate[] {
  const picked: ResolvedQuestionCandidate[] = [];
  const usedCategories = new Map<string, number>();
  const usedTemplates = new Set<string>();

  for (const candidate of candidates) {
    if (picked.length >= limit) break;

    const cat = candidate.template.category;
    const catCount = usedCategories.get(cat) ?? 0;
    const catQuota = CATEGORY_QUOTAS[cat] ?? 1;

    if (catCount >= catQuota) continue;
    if (usedTemplates.has(candidate.template.template_key)) continue;

    picked.push(candidate);
    usedCategories.set(cat, catCount + 1);
    usedTemplates.add(candidate.template.template_key);
  }

  if (picked.length < limit) {
    for (const candidate of candidates) {
      if (picked.length >= limit) break;
      if (picked.some((p) => p.template.id === candidate.template.id && p.contextKey === candidate.contextKey)) {
        continue;
      }
      if (usedTemplates.has(candidate.template.template_key)) continue;
      picked.push(candidate);
      usedTemplates.add(candidate.template.template_key);
    }
  }

  return picked.slice(0, limit);
}

function formatEquipmentLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
