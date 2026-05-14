import OpenAI from "openai";
import { generateAutoSimulationShifts, type GeneratedSimulationShift } from "@/lib/staff/autoSimulation";
import { buildExternalPlanningPromptFr } from "@/lib/staff/buildExternalPlanningPromptFr";
import type { WeekResolvedDay } from "@/lib/staff/planningResolve";
import { type OpeningHoursMap, type PlanningDayKey } from "@/lib/staff/planningHoursTypes";
import { mergedStaffWorkBands, shiftContainedInTimeBands } from "@/lib/staff/staffWorkWindows";
import { netPlannedMinutes, plannedDurationMinutes } from "@/lib/staff/timeHelpers";
import type { StaffMember } from "@/lib/staff/types";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  parisWallClockToUtc,
  parisYmdFromInstant,
  shiftContainedInParisWallBands,
} from "@/lib/staff/planningParisWall";
import { parseISODateLocal, toISODateString } from "@/lib/staff/weekUtils";

const planningModel = () => process.env.OPENAI_PLANNING_MODEL?.trim() || "gpt-4o-2024-08-06";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Marge sur le volume contrat pour accepter des créneaux légèrement au-dessus (pause, arrondis). */
const CONTRACT_FLEX = 1.08;

const PLANNING_AI_PRIORITES_RAPPEL = `Priorités : (1) respecter ouverture × dispos × prépa, (2) atteindre l’objectif d’effectif par jour, (3) rapprocher chacun de son **volume hebdomadaire cible** (contrat), (4) jours fermés = aucun service.`;

const PLANNING_GENERATIVE_SYSTEM_PROMPT = `
Tu es un expert en planification d’équipe pour la restauration (France).

Tu reçois les mêmes contraintes métier qu’un export « Copier le prompt » (horaires, minimums d’effectif, semaine résolue, équipe). Tu dois **proposer le planning complet de la semaine** sous forme d’**un seul objet JSON** valide.

Tu peux utiliser **l’un ou l’autre** des formats suivants (le serveur accepte les deux) :

**Format A — style assistant conversationnel (recommandé, proche ChatGPT)**  
- \`planning\` : tableau d’objets jour avec au minimum \`date\` (AAAA-MM-JJ), \`closed\` (booléen), \`staff\` : tableau de { \`name\` (prénom/nom **identique** à la fiche équipe), \`shifts\` : [ { \`start\`, \`end\` en **HH:mm** en **Europe/Paris** (heure « murale » française sur ce jour civil) } ] }.  
- **Critique** : chaque \`name\` doit être la **même chaîne** que dans le bloc équipe du message (casse, accents, espaces). Sinon le serveur ignore les créneaux. Si plusieurs prénoms courts se ressemblent (ex. Tom / Tonio), ne pas les confondre : reprends le libellé **tel quel** du dictionnaire id→nom.
- Jours fermés : \`closed: true\` et \`staff\` vide ou absent — **obligatoire** si le message utilisateur indique pour ce jour **aucune plage** (ouverture + hors client établissement fusionnées = vide) : aucun collaborateur ce jour-là.  
- Optionnel : \`restaurant\`, \`week\`, \`weekly_totals\` (pour ta cohérence interne).

**Format B — technique**  
- \`shifts\` : [ { \`staff_member_id\` (UUID du bloc id→nom), \`starts_at\`, \`ends_at\` en ISO 8601, \`break_minutes\`, \`notes\` } ].

**Dans tous les cas** ajoute \`rationale_short\` (string) : synthèse pour le gérant (plancher d’effectif, renforts sur les pics, contrats, vigilances).

Règles métier :
- Respecte les **fenêtres** (ouverture, hors client, dispos, prépa) du prompt.
- Effectifs journaliers = **minimums** ; surplus en **renfort** sur les pics lorsque possible.
- N’invente pas de collaborateurs : noms ou UUIDs issus uniquement du message utilisateur.
- Équilibre les **heures nettes hebdomadaires** vers les cibles contrat quand c’est compatible avec les fenêtres.
`.trim();

export type RestaurantPlanningAiProfile = {
  name: string;
  activity_type: string | null;
  avg_covers: number | null;
  service_type: string | null;
};

export async function buildPlanningAiActivityDigest(restaurantId: string): Promise<string> {
  const parts: string[] = [];

  const { data: services } = await supabaseServer
    .from("services")
    .select("service_date, service_type")
    .eq("restaurant_id", restaurantId)
    .order("service_date", { ascending: false })
    .limit(24);

  if (services && services.length > 0) {
    const lunch = services.filter((s) => (s as { service_type?: string }).service_type === "lunch").length;
    const dinner = services.filter((s) => (s as { service_type?: string }).service_type === "dinner").length;
    const both = services.filter((s) => (s as { service_type?: string }).service_type === "both").length;
    const recent = (services as { service_date: string }[])
      .slice(0, 5)
      .map((s) => String(s.service_date).slice(0, 10))
      .join(", ");
    parts.push(
      `Derniers services (24) : ${services.length} entrées — déjeuner ${lunch}, dîner ${dinner}, les deux ${both}. Dates : ${recent}.`
    );
  } else {
    parts.push("Aucun service récent dans l’historique.");
  }

  const { data: rev } = await supabaseServer
    .from("restaurant_monthly_revenues")
    .select("month, revenue_ttc")
    .eq("restaurant_id", restaurantId)
    .order("month", { ascending: false })
    .limit(5);

  if (rev && rev.length > 0) {
    const lines = (rev as { month: string; revenue_ttc: number | null }[])
      .map((r) => `${r.month} : ${r.revenue_ttc != null ? `${r.revenue_ttc} € TTC` : "n/c"}`)
      .join(" ; ");
    parts.push(`Chiffre mensuel récent : ${lines}.`);
  }

  return parts.join("\n");
}

function defaultBreakMinutes(durM: number): number | null {
  return durM > 360 ? 30 : null;
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function normalizePlanningPersonName(s: string): string {
  return stripAccents(s.trim().replace(/\s+/g, " ").toLowerCase());
}

function findStaffIdByDisplayName(active: StaffMember[], displayName: string): string | null {
  const raw = (displayName ?? "").trim();
  if (!raw) return null;
  const key = normalizePlanningPersonName(raw);
  for (const m of active) {
    if (normalizePlanningPersonName(m.display_name ?? "") === key) return m.id;
  }
  const first = key.split(/\s+/)[0] ?? "";
  if (first.length < 2) return null;
  const hits = active.filter((m) => {
    const dn = normalizePlanningPersonName(m.display_name ?? "");
    return dn === first || dn.startsWith(`${first} `);
  });
  if (hits.length === 1) return hits[0]!.id;
  return null;
}

function extractShiftsFromNestedPlanningJson(parsed: unknown, active: StaffMember[]): GeneratedSimulationShift[] {
  if (!parsed || typeof parsed !== "object") return [];
  const plan = (parsed as Record<string, unknown>).planning;
  if (!Array.isArray(plan)) return [];
  const out: GeneratedSimulationShift[] = [];

  for (const dayBlock of plan) {
    if (!dayBlock || typeof dayBlock !== "object") continue;
    const rec = dayBlock as Record<string, unknown>;
    const dateStr = typeof rec.date === "string" ? rec.date.trim().slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
    if (rec.closed === true) continue;

    const staffList = rec.staff;
    if (!Array.isArray(staffList)) continue;

    for (const person of staffList) {
      if (!person || typeof person !== "object") continue;
      const pr = person as Record<string, unknown>;
      const nm = typeof pr.name === "string" ? pr.name : "";
      const staffId = findStaffIdByDisplayName(active, nm);
      if (!staffId) continue;

      const shiftsArr = pr.shifts;
      if (!Array.isArray(shiftsArr)) continue;
      for (const sh of shiftsArr) {
        if (!sh || typeof sh !== "object") continue;
        const sr = sh as Record<string, unknown>;
        const startClock = typeof sr.start === "string" ? sr.start : "";
        const endClock = typeof sr.end === "string" ? sr.end : "";
        const startDt = parisWallClockToUtc(dateStr, startClock);
        const endDt = parisWallClockToUtc(dateStr, endClock);
        if (!startDt || !endDt || !(startDt < endDt)) continue;
        const durM = plannedDurationMinutes(startDt.toISOString(), endDt.toISOString());
        if (durM < 15) continue;
        out.push({
          staff_member_id: staffId,
          starts_at: startDt.toISOString(),
          ends_at: endDt.toISOString(),
          break_minutes: defaultBreakMinutes(durM),
          notes: `IA planning · ${startClock}–${endClock}`,
        });
      }
    }
  }
  return out;
}

function extractRationaleShort(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object") return null;
  const r = (parsed as Record<string, unknown>).rationale_short;
  return typeof r === "string" && r.trim() ? r.trim() : null;
}

function extractShiftsFromGenerativePayload(parsed: unknown): GeneratedSimulationShift[] {
  if (!parsed || typeof parsed !== "object") return [];
  const rec = parsed as { shifts?: unknown };
  if (!Array.isArray(rec.shifts)) return [];
  const out: GeneratedSimulationShift[] = [];
  for (const row of rec.shifts) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.staff_member_id === "string" ? r.staff_member_id.trim() : "";
    const sta = typeof r.starts_at === "string" ? r.starts_at.trim() : "";
    const ena = typeof r.ends_at === "string" ? r.ends_at.trim() : "";
    if (!UUID_RE.test(id) || !sta || !ena) continue;
    let bm: number | null = null;
    if (r.break_minutes != null) {
      const b = Number(r.break_minutes);
      if (Number.isFinite(b)) bm = Math.round(b);
    }
    const notes = r.notes == null ? null : typeof r.notes === "string" ? r.notes : null;
    out.push({
      staff_member_id: id,
      starts_at: sta,
      ends_at: ena,
      break_minutes: bm,
      notes,
    });
  }
  return out;
}

function totalNetMinutes(shifts: GeneratedSimulationShift[]): number {
  let t = 0;
  for (const s of shifts) {
    t += netPlannedMinutes(s.starts_at, s.ends_at, s.break_minutes);
  }
  return t;
}

function pickBetterNormalized(params: {
  hasPlanningArray: boolean;
  nested: GeneratedSimulationShift[];
  flat: GeneratedSimulationShift[];
}): GeneratedSimulationShift[] {
  const { hasPlanningArray, nested, flat } = params;
  const sN = totalNetMinutes(nested);
  const sF = totalNetMinutes(flat);
  if (sN === 0 && sF === 0) return [];
  if (sN === 0) return flat;
  if (sF === 0) return nested;
  if (sN > sF) return nested;
  if (sF > sN) return flat;
  return hasPlanningArray ? nested : flat;
}

function validateAndNormalizeShifts(params: {
  raw: GeneratedSimulationShift[];
  staffById: Map<string, StaffMember>;
  resolvedByYmd: Map<string, WeekResolvedDay>;
  /** Paris : JSON HH:mm + grille France ; serveur : moteur auto (dates locales runtime). */
  containment: "paris" | "server";
}): GeneratedSimulationShift[] {
  const allowedYm = new Set(params.resolvedByYmd.keys());

  const sorted = [...params.raw].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  const usedWeeklyNet = new Map<string, number>();
  const lastEndMs = new Map<string, number>();
  const out: GeneratedSimulationShift[] = [];

  for (const row of sorted) {
    const member = params.staffById.get(row.staff_member_id);
    if (!member) continue;

    const start = new Date(row.starts_at);
    const end = new Date(row.ends_at);
    if (!(start < end) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

    const ymdStart =
      params.containment === "paris" ? parisYmdFromInstant(start) : toISODateString(start);
    const ymdEnd = params.containment === "paris" ? parisYmdFromInstant(end) : toISODateString(end);
    if (ymdStart !== ymdEnd) continue;
    if (!allowedYm.has(ymdStart)) continue;

    const wd = params.resolvedByYmd.get(ymdStart);
    if (!wd) continue;

    const allowed = mergedStaffWorkBands(member, wd);
    const inBands =
      params.containment === "paris" ?
        shiftContainedInParisWallBands(start, end, allowed)
      : shiftContainedInTimeBands(start, end, allowed);
    if (!inBands) continue;

    const prevEnd = lastEndMs.get(member.id) ?? 0;
    if (start.getTime() < prevEnd) continue;

    const grossM = plannedDurationMinutes(row.starts_at, row.ends_at);
    if (grossM < 15) continue;

    let breakM = row.break_minutes;
    if (breakM != null && (!Number.isFinite(breakM) || breakM < 0 || breakM >= grossM)) {
      breakM = defaultBreakMinutes(grossM);
    } else if (breakM == null) {
      breakM = defaultBreakMinutes(grossM);
    }

    const net = netPlannedMinutes(row.starts_at, row.ends_at, breakM);
    const capH = member.target_weekly_hours;
    if (capH != null && Number.isFinite(capH) && capH > 0) {
      const prev = usedWeeklyNet.get(member.id) ?? 0;
      const capM = capH * 60 * CONTRACT_FLEX;
      if (prev + net > capM + 0.5) continue;
      usedWeeklyNet.set(member.id, prev + net);
    }

    lastEndMs.set(member.id, end.getTime());
    out.push({
      staff_member_id: row.staff_member_id,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      break_minutes: breakM,
      notes:
        row.notes?.trim() ?
          row.notes.trim().slice(0, 400)
        : `IA · ${start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}–${end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
    });
  }

  return out;
}

export type AiPlanningSimulationResult =
  | { ok: true; shifts: GeneratedSimulationShift[]; narrativeFr: string | null; usedFallbackAuto: boolean }
  | { ok: false; error: string };

export async function generateAiPlanningSimulationShifts(params: {
  restaurantName: string;
  weekMondayYmd: string;
  profile: RestaurantPlanningAiProfile | null;
  activityDigest: string;
  resolvedWeekDays: WeekResolvedDay[];
  staff: StaffMember[];
  hourMaps: { opening: OpeningHoursMap; staffExtra: OpeningHoursMap };
  staffTargetsWeekly: Partial<Record<PlanningDayKey, number>>;
}): Promise<AiPlanningSimulationResult> {
  const monday = parseISODateLocal(params.weekMondayYmd.trim());
  if (!monday) return { ok: false, error: "Semaine invalide." };

  const active = params.staff.filter((s) => s.active);
  if (active.length === 0) return { ok: false, error: "Aucun collaborateur actif." };

  const staffById = new Map(active.map((s) => [s.id, s]));
  const resolvedByYmd = new Map(params.resolvedWeekDays.map((d) => [d.ymd, d]));

  const engineShifts = generateAutoSimulationShifts({
    resolvedWeekDays: params.resolvedWeekDays,
    staff: params.staff,
  });

  const normalizedEngine = validateAndNormalizeShifts({
    raw: engineShifts,
    staffById,
    resolvedByYmd,
    containment: "server",
  });

  const engineFallback = normalizedEngine.length > 0 ? normalizedEngine : engineShifts;

  if (engineFallback.length === 0) {
    return {
      ok: false,
      error:
        "Aucun créneau généré : vérifiez les horaires d’ouverture, la taille d’équipe, les disponibilités et les objectifs d’effectif.",
    };
  }

  const promptExportFr = buildExternalPlanningPromptFr({
    restaurantName: params.restaurantName.trim() || params.profile?.name?.trim() || "Restaurant",
    weekMondayIso: params.weekMondayYmd,
    openingHours: params.hourMaps.opening,
    staffExtraBands: params.hourMaps.staffExtra,
    staffTargetsWeekly: params.staffTargetsWeekly,
    resolvedWeekDays: params.resolvedWeekDays,
    staff: params.staff,
  });

  const digestBlock =
    params.activityDigest.trim().length > 0 ?
      `\n\n---\nIndicateurs d’activité :\n${params.activityDigest.trim()}`
    : "";

  const staffDirectory = Object.fromEntries(
    active.map((s) => [s.id, (s.display_name ?? "").trim() || s.id])
  );
  const staffDirectoryJson = JSON.stringify(staffDirectory);

  const openAiUserContent = `${PLANNING_AI_PRIORITES_RAPPEL}

**Semaine (lundi ISO) :** ${params.weekMondayYmd.trim()}

**Correspondance staff_member_id → nom** (pour le format B ; pour le format A utilise exactement le nom affiché) :
${staffDirectoryJson}

---

Contexte métier — même texte que la page Équipe (export prompt) :

${promptExportFr}${digestBlock}

---

Propose le **planning complet de la semaine** en **un objet JSON**. Tu peux utiliser le **format \`planning\` / \`name\` / \`start\`–\`end\` en HH:mm (Europe/Paris)** (comme dans ChatGPT) **ou** le format **\`shifts\`** avec UUID + ISO — voir le message système. Ajoute toujours **\`rationale_short\`** (string).`;

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return {
      ok: true,
      shifts: engineFallback,
      narrativeFr:
        "Planning calculé par le moteur interne (clé OpenAI absente : pas de génération IA des créneaux).",
      usedFallbackAuto: true,
    };
  }

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: planningModel(),
      temperature: 0.25,
      max_completion_tokens: 16384,
      messages: [
        { role: "system", content: PLANNING_GENERATIVE_SYSTEM_PROMPT },
        { role: "user", content: openAiUserContent },
      ],
      response_format: { type: "json_object" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur OpenAI.";
    return {
      ok: true,
      shifts: engineFallback,
      narrativeFr: `Erreur API (${msg}). Planning affiché : moteur interne (repli).`,
      usedFallbackAuto: true,
    };
  }

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    return {
      ok: true,
      shifts: engineFallback,
      narrativeFr: "Réponse vide du modèle. Planning affiché : moteur interne (repli).",
      usedFallbackAuto: true,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: true,
      shifts: engineFallback,
      narrativeFr: "JSON invalide du modèle. Planning affiché : moteur interne (repli).",
      usedFallbackAuto: true,
    };
  }

  const hasPlanningArray =
    Boolean(parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).planning));

  const rawFlat = extractShiftsFromGenerativePayload(parsed);
  const rawNested = extractShiftsFromNestedPlanningJson(parsed, active);

  const normFlat = validateAndNormalizeShifts({
    raw: rawFlat,
    staffById,
    resolvedByYmd,
    containment: "paris",
  });
  const normNested = validateAndNormalizeShifts({
    raw: rawNested,
    staffById,
    resolvedByYmd,
    containment: "paris",
  });

  const normalizedGen = pickBetterNormalized({
    hasPlanningArray,
    nested: normNested,
    flat: normFlat,
  });

  const rationale = extractRationaleShort(parsed);

  if (normalizedGen.length > 0) {
    return {
      ok: true,
      shifts: normalizedGen,
      narrativeFr:
        rationale ??
        "Planning généré par l’IA (créneaux validés côté serveur : fenêtres, contrats, semaine).",
      usedFallbackAuto: false,
    };
  }

  const explain =
    rawFlat.length === 0 && rawNested.length === 0 ?
      "L’IA n’a renvoyé aucun créneau exploitable (ni format `shifts`, ni `planning` / nom / HH:mm)."
    : "Les créneaux renvoyés par l’IA ne passent pas la validation (fenêtres, contrat, semaine).";
  return {
    ok: true,
    shifts: engineFallback,
    narrativeFr: `${explain} Planning affiché : moteur interne.${rationale ? ` — ${rationale}` : ""}`,
    usedFallbackAuto: true,
  };
}
