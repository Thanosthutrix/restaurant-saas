import { supabaseServer } from "@/lib/supabaseServer";
import { normalizeDishLabel } from "@/lib/normalizeDishLabel";
import { stringSimilarity } from "./stringSimilarity";

const LOG_PREFIX = "[findDishMatchCandidates]";

export type DishCandidate = {
  dishId: string;
  dishName: string;
  score: number;
  reason: string;
};

export type MatchResult = {
  normalizedLabel: string;
  exactDishId: string | null;
  exactDishName: string | null;
  candidates: DishCandidate[];
};

const TOP_N = 5;
const SCORE_EXACT_NAME = 100;
const SCORE_EXACT_ALIAS = 80;
const SCORE_DISH_CONTAINS_LABEL = 40;
const SCORE_LABEL_CONTAINS_DISH = 30;
const SCORE_PER_COMMON_WORD = 10;
/** Score max pour le fuzzy : en dessous de 100 pour ne jamais auto-associer. */
const SCORE_FUZZY_MAX = 85;
/** Seuil à partir duquel on propose des suggestions (sous ce seuil = unmatched). */
export const SUGGESTION_SCORE_MIN = 50;

export async function findDishMatchCandidates(
  restaurantId: string,
  rawLabel: string
): Promise<MatchResult> {
  const normalizedLabel = normalizeDishLabel(rawLabel);
  const result: MatchResult = {
    normalizedLabel,
    exactDishId: null,
    exactDishName: null,
    candidates: [],
  };

  if (!normalizedLabel) return result;

  const [aliasesRes, dishesRes] = await Promise.all([
    supabaseServer
      .from("dish_aliases")
      .select("dish_id, alias_normalized")
      .eq("restaurant_id", restaurantId)
      .not("alias_normalized", "is", null),
    supabaseServer
      .from("dishes")
      .select("id, name, name_normalized")
      .eq("restaurant_id", restaurantId),
  ]);

  const dishes = (dishesRes.data ?? []) as { id: string; name: string; name_normalized: string | null }[];
  const aliases = (aliasesRes.data ?? []) as { dish_id: string; alias_normalized: string }[];

  const dishById = new Map(dishes.map((d) => [d.id, d]));

  for (const a of aliases) {
    const an = (a.alias_normalized ?? "").trim();
    if (!an) continue;
    if (an === normalizedLabel) {
      const dish = dishById.get(a.dish_id);
      if (dish) {
        result.exactDishId = a.dish_id;
        result.exactDishName = dish.name;
        return result;
      }
    }
  }

  for (const d of dishes) {
    const dn = (d.name_normalized ?? normalizeDishLabel(d.name)).trim();
    if (!dn) continue;
    if (dn === normalizedLabel) {
      result.exactDishId = d.id;
      result.exactDishName = d.name;
      return result;
    }
  }

  const scored: DishCandidate[] = [];
  const labelWords = new Set(normalizedLabel.split(" ").filter(Boolean));

  for (const d of dishes) {
    const dn = (d.name_normalized ?? normalizeDishLabel(d.name)).trim();
    if (!dn) continue;
    let score = 0;
    let reason = "";

    if (dn === normalizedLabel) {
      score = SCORE_EXACT_NAME;
      reason = "exact name";
    } else if (dn.includes(normalizedLabel)) {
      score = SCORE_DISH_CONTAINS_LABEL;
      reason = "dish contains label";
    } else if (normalizedLabel.includes(dn)) {
      score = SCORE_LABEL_CONTAINS_DISH;
      reason = "label contains dish";
    } else {
      const dishWords = dn.split(" ").filter(Boolean);
      const common = dishWords.filter((w) => labelWords.has(w));
      if (common.length) {
        score = common.length * SCORE_PER_COMMON_WORD;
        reason = "common words";
      }
    }

    const fuzzyRatio = stringSimilarity(normalizedLabel, dn);
    const fuzzyScore = Math.floor(fuzzyRatio * SCORE_FUZZY_MAX);
    if (fuzzyScore > score) {
      score = fuzzyScore;
      reason = "fuzzy";
    }

    for (const a of aliases) {
      if (a.dish_id !== d.id) continue;
      const an = (a.alias_normalized ?? "").trim();
      if (an === normalizedLabel && score < SCORE_EXACT_ALIAS) {
        score = SCORE_EXACT_ALIAS;
        reason = "exact alias";
      }
    }

    if (score > 0) {
      scored.push({ dishId: d.id, dishName: d.name, score, reason });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  result.candidates = scored.slice(0, TOP_N);

  const best = result.candidates[0];
  if (best) {
    console.log(
      LOG_PREFIX,
      "raw:",
      rawLabel,
      "| normalized:",
      normalizedLabel,
      "| best:",
      best.dishName,
      "score:",
      best.score,
      "reason:",
      best.reason,
      "| decision:",
      result.exactDishId ? "matched" : best.score >= SUGGESTION_SCORE_MIN ? "suggested" : "unmatched"
    );
  }
  return result;
}
