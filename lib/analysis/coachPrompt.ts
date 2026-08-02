/**
 * Synthèse « Coach Resto » via OpenAI — 3 conseils bienveillants basés sur le payload agrégé.
 */

import OpenAI from "openai";
import type { CoachPayload, DeterministicAnalysisPayload } from "@/lib/analysis/reportTypes";
import { QUADRANT_LABELS } from "@/lib/analysis/analysisReportBuilder";

const coachModel = () => process.env.OPENAI_COACH_MODEL?.trim() || "gpt-4o-mini";

const SYSTEM_PROMPT = `
Tu es un coach restauration bienveillant et pragmatique pour un gérant de restaurant en France.
Tu reçois un JSON de chiffres (ventes, marges, matrice menu, pertes, micro-sondages anonymes du staff).
Tu dois répondre UNIQUEMENT en JSON valide avec cette forme exacte :
{
  "summary": "2-3 phrases chaleureuses qui contextualisent la période",
  "insights": [
    {
      "title": "Titre court actionnable",
      "body": "Conseil concret en 2-4 phrases, ton coach pas condescendant",
      "tone": "encourage" | "alert" | "action",
      "relatedDishId": "uuid ou null",
      "relatedInventoryItemId": "uuid ou null"
    }
  ]
}
Règles :
- Exactement 3 insights, triés par impact business décroissant.
- Ne jamais inventer de chiffres absents du JSON.
- Citer les plats par leur nom si présents dans le payload.
- Pas de markdown, pas de texte hors JSON.
`.trim();

function compactPayloadForLlm(payload: DeterministicAnalysisPayload): Record<string, unknown> {
  return {
    period: payload.period,
    serviceCount: payload.serviceCount,
    totals: payload.totals,
    foodCostGap: payload.foodCostGap,
    matrixSummary: {
      star: payload.menuMatrix.filter((m) => m.quadrant === "star").slice(0, 5).map(summarizeMatrixItem),
      plowhorse: payload.menuMatrix.filter((m) => m.quadrant === "plowhorse").slice(0, 5).map(summarizeMatrixItem),
      puzzle: payload.menuMatrix.filter((m) => m.quadrant === "puzzle").slice(0, 5).map(summarizeMatrixItem),
      dog: payload.menuMatrix.filter((m) => m.quadrant === "dog").slice(0, 5).map(summarizeMatrixItem),
    },
    quadrantLabels: QUADRANT_LABELS,
    waste: payload.waste,
    feedback: payload.feedback,
    highlights: payload.highlights,
  };
}

function summarizeMatrixItem(m: {
  dishId: string;
  dishName: string;
  qtySold: number;
  marginPct: number | null;
  quadrant: string;
}) {
  return {
    dishId: m.dishId,
    dishName: m.dishName,
    qtySold: m.qtySold,
    marginPct: m.marginPct,
    quadrant: m.quadrant,
  };
}

function parseCoachJson(raw: string): CoachPayload | null {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd <= jsonStart) return null;

  try {
    const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as {
      summary?: string;
      insights?: {
        title?: string;
        body?: string;
        tone?: string;
        relatedDishId?: string | null;
        relatedInventoryItemId?: string | null;
      }[];
    };

    const insights = (parsed.insights ?? []).slice(0, 3).map((i) => ({
      title: String(i.title ?? "Conseil"),
      body: String(i.body ?? ""),
      tone: (["encourage", "alert", "action"].includes(String(i.tone))
        ? i.tone
        : "action") as "encourage" | "alert" | "action",
      relatedDishId: i.relatedDishId ?? null,
      relatedInventoryItemId: i.relatedInventoryItemId ?? null,
    }));

    if (insights.length === 0) return null;

    return {
      summary: String(parsed.summary ?? ""),
      insights,
      generatedAt: new Date().toISOString(),
      model: coachModel(),
    };
  } catch {
    return null;
  }
}

export async function generateCoachPayload(
  payload: DeterministicAnalysisPayload
): Promise<{ coach: CoachPayload | null; error: string | null }> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return { coach: fallbackCoach(payload), error: null };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const userContent = JSON.stringify(compactPayloadForLlm(payload), null, 2);

  try {
    const response = await openai.chat.completions.create({
      model: coachModel(),
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Voici les données de la période. Rédige la synthèse coach :\n\n${userContent}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const coach = parseCoachJson(text);
    if (coach) return { coach, error: null };
    return { coach: fallbackCoach(payload), error: "Réponse IA invalide — synthèse de secours utilisée." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur OpenAI";
    return { coach: fallbackCoach(payload), error: msg };
  }
}

function fallbackCoach(payload: DeterministicAnalysisPayload): CoachPayload {
  const insights = [];
  if (payload.highlights.topSeller) {
    insights.push({
      title: `Votre moteur : ${payload.highlights.topSeller.dishName}`,
      body: `${payload.highlights.topSeller.qty} ventes sur la période. Assurez-vous que la mise en place et les quantités en recette suivent ce volume.`,
      tone: "encourage" as const,
      relatedDishId: payload.highlights.topSeller.dishId,
      relatedInventoryItemId: null,
    });
  }
  if (payload.waste.totalCostHt > 0) {
    insights.push({
      title: "Pertes à surveiller",
      body: `${payload.waste.totalCostHt.toFixed(0)} € HT de pertes enregistrées. Chaque saisie en fin de service aide à ajuster les commandes fournisseur.`,
      tone: "alert" as const,
      relatedDishId: null,
      relatedInventoryItemId: null,
    });
  }
  if (payload.foodCostGap.gapPctPoints != null && payload.foodCostGap.gapPctPoints > 2) {
    insights.push({
      title: "Écart food cost réel vs théorique",
      body: `Le coût matière réel dépasse le théorique de ${payload.foodCostGap.gapPctPoints} points. Vérifiez les portions en cuisine et les pertes non saisies.`,
      tone: "action" as const,
      relatedDishId: null,
      relatedInventoryItemId: null,
    });
  }

  while (insights.length < 3) {
    insights.push({
      title: "Continuez à collecter le ressenti terrain",
      body: "Les micro-sondages anonymes en fin de service enrichissent ce rapport. Plus il y a de retours, plus les recommandations seront pertinentes.",
      tone: "encourage" as const,
      relatedDishId: null,
      relatedInventoryItemId: null,
    });
  }

  return {
    summary: `Sur ${payload.serviceCount} service(s), CA HT ${payload.totals.revenueHt.toFixed(0)} € et marge ${payload.totals.marginPct?.toFixed(1) ?? "—"} %. Voici 3 pistes pour la suite.`,
    insights: insights.slice(0, 3),
    generatedAt: new Date().toISOString(),
    model: "fallback",
  };
}
