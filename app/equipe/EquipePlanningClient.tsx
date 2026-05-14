"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { StaffPlanningProfileForm } from "@/components/staff/StaffPlanningProfileForm";
import { ManualWeekPlanner, PlanningHoursRecap } from "@/components/staff/ManualWeekPlanner";
import type { PlanningAlert } from "@/lib/staff/planningAlerts";
import {
  resolveWeekPlanningDays,
  type PlanningDayOverrideRow,
  type WeekResolvedDay,
} from "@/lib/staff/planningResolve";
import type { OpeningHoursMap, PlanningDayKey } from "@/lib/staff/planningHoursTypes";
import type { StaffMember, WorkShiftWithDetails } from "@/lib/staff/types";
import { addDays, parseISODateLocal, toISODateString } from "@/lib/staff/weekUtils";
import {
  NAV_KEY_GROUPS,
  NAV_KEY_LABELS_FR,
  NAV_KEY_READONLY_PAIRS,
  type ShellNavKey,
  resolveNavKeys,
} from "@/lib/auth/appRoles";
import {
  clearStaffUserLinkAction,
  createSimulationShiftAction,
  createStaffInviteAction,
  createStaffMemberAction,
  createWeekSimulationAction,
  createWorkShiftAction,
  deactivateStaffMemberAction,
  generateAutoSimulationShiftsAction,
  linkMyAccountToStaffAction,
  publishWeekSimulationAction,
  updateStaffNavPermissionsAction,
  discardWeekSimulationAction,
} from "./actions";
import {
  uiBtnOutlineSm,
  uiBtnPrimarySm,
  uiBtnSecondary,
  uiCard,
  uiInput,
  uiLabel,
  uiSuccess,
} from "@/components/ui/premium";
import { STAFF_COLORS, STAFF_COLOR_HEX, STAFF_COLOR_LABELS, resolveStaffColorIndex } from "@/lib/staff/staffColors";

function toAbsoluteInviteUrl(joinUrlFromServer: string): string {
  const t = joinUrlFromServer.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (typeof window === "undefined") return t;
  const path = t.startsWith("/") ? t : `/${t}`;
  return `${window.location.origin}${path}`;
}


function formatDatetimeLocalFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}


/** Éditeur de permissions pages par collaborateur (checkboxes groupées). */
function NavPermissionsEditor({
  member,
  pending,
  onSave,
}: {
  member: { id: string; app_role: string | null; app_nav_keys: string[] | null };
  pending: boolean;
  onSave: (keys: string[]) => void;
}) {
  const initialKeys = resolveNavKeys(member.app_nav_keys, member.app_role);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(initialKeys));
  const [dirty, setDirty] = useState(false);

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setDirty(true);
  }

  type Level = "none" | "readonly" | "full";

  function getPageLevel(baseKey: ShellNavKey): Level {
    if (checked.has(baseKey)) return "full";
    const ro = NAV_KEY_READONLY_PAIRS[baseKey];
    if (ro && checked.has(ro)) return "readonly";
    return "none";
  }

  function setPageLevel(baseKey: ShellNavKey, level: Level) {
    const ro = NAV_KEY_READONLY_PAIRS[baseKey];
    setChecked((prev) => {
      const next = new Set(prev);
      next.delete(baseKey);
      if (ro) next.delete(ro);
      if (level === "full") next.add(baseKey);
      else if (level === "readonly" && ro) next.add(ro);
      return next;
    });
    setDirty(true);
  }

  const levelLabels: Record<Level, string> = {
    none: "Aucun",
    readonly: "Lecture",
    full: "Complet",
  };

  const levelStyles: Record<Level, Record<Level, string>> = {
    none: {
      none: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
      readonly: "text-slate-400 hover:text-slate-600 hover:bg-slate-50",
      full: "text-slate-400 hover:text-slate-600 hover:bg-slate-50",
    },
    readonly: {
      none: "text-slate-400 hover:text-slate-600 hover:bg-slate-50",
      readonly: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
      full: "text-slate-400 hover:text-slate-600 hover:bg-slate-50",
    },
    full: {
      none: "text-slate-400 hover:text-slate-600 hover:bg-slate-50",
      readonly: "text-slate-400 hover:text-slate-600 hover:bg-slate-50",
      full: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    },
  };

  return (
    <div className="mt-4">
      <p className={`${uiLabel} mb-2`}>Pages accessibles</p>
      <div className="space-y-4">
        {NAV_KEY_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {group.label}
            </p>
            <div className="space-y-1.5">
              {group.keys.map((key) => {
                const baseKey = key as ShellNavKey;
                const hasReadonly = baseKey in NAV_KEY_READONLY_PAIRS;
                if (hasReadonly) {
                  const level = getPageLevel(baseKey);
                  return (
                    <div key={key} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1 hover:bg-slate-50">
                      <span className="text-xs text-slate-700">{NAV_KEY_LABELS_FR[baseKey]}</span>
                      <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5 gap-0.5">
                        {(["none", "readonly", "full"] as Level[]).map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            disabled={pending}
                            onClick={() => setPageLevel(baseKey, lvl)}
                            className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-all ${levelStyles[level][lvl]}`}
                          >
                            {levelLabels[lvl]}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={checked.has(key)}
                      disabled={pending}
                      onChange={() => toggle(key)}
                    />
                    {NAV_KEY_LABELS_FR[baseKey]}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {dirty && (
        <button
          type="button"
          disabled={pending}
          className={`${uiBtnPrimarySm} mt-3`}
          onClick={() => { onSave([...checked]); setDirty(false); }}
        >
          Enregistrer les accès
        </button>
      )}
    </div>
  );
}

type PlanningMode = "real" | "simulation";

type Props = {
  restaurantId: string;
  currentUserId: string;
  weekMondayIso: string;
  initialPlanningMode: PlanningMode;
  staff: StaffMember[];
  shifts: WorkShiftWithDetails[];
  simulationId: string | null;
  simulationShifts: WorkShiftWithDetails[];
  resolvedWeekDays: WeekResolvedDay[];
  planningOpeningHours: OpeningHoursMap;
  planningStaffExtraBands: OpeningHoursMap;
  planningStaffTargetsWeekly: Partial<Record<PlanningDayKey, number>>;
  planningDayOverrides: PlanningDayOverrideRow[];
  planningAlerts: PlanningAlert[];
  simulationAlerts: PlanningAlert[];
};

export function EquipePlanningClient({
  restaurantId,
  currentUserId,
  weekMondayIso,
  initialPlanningMode,
  staff,
  shifts,
  simulationId: simulationIdProp,
  simulationShifts,
  resolvedWeekDays,
  planningOpeningHours,
  planningStaffExtraBands,
  planningStaffTargetsWeekly,
  planningDayOverrides,
  planningAlerts,
  simulationAlerts,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [planningMode, setPlanningMode] = useState<PlanningMode>(initialPlanningMode);
  const [optimisticSimulationId, setOptimisticSimulationId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");

  const [shiftStaffId, setShiftStaffId] = useState(staff[0]?.id ?? "");
  const [shiftStart, setShiftStart] = useState("");
  const [shiftEnd, setShiftEnd] = useState("");
  const [shiftNotes, setShiftNotes] = useState("");
  const [shiftBreakMinutes, setShiftBreakMinutes] = useState("");

  /** Collaborateur dont la tuile détail est ouverte. */
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  /** Lien d'invitation généré, affiché dans la tuile pour copie manuelle. */
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const monday = useMemo(() => parseISODateLocal(weekMondayIso), [weekMondayIso]);

  const resolvedWeekDaysForGrid = useMemo(() => {
    const m = parseISODateLocal(weekMondayIso);
    if (!m) return resolvedWeekDays;
    return resolveWeekPlanningDays(
      m,
      planningOpeningHours,
      planningStaffExtraBands,
      planningStaffTargetsWeekly,
      planningDayOverrides
    );
  }, [
    weekMondayIso,
    resolvedWeekDays,
    planningOpeningHours,
    planningStaffExtraBands,
    planningStaffTargetsWeekly,
    planningDayOverrides,
  ]);

  /** Index couleur par collaborateur — respecte color_index quand défini, sinon tri par id. */
  const staffColorIndex = useMemo(() => {
    const allIds = staff.map((s) => s.id);
    return new Map(staff.map((s) => [s.id, resolveStaffColorIndex(s.id, s.color_index, allIds)]));
  }, [staff]);

  const prevWeek = monday ? toISODateString(addDays(monday, -7)) : weekMondayIso;
  const nextWeek = monday ? toISODateString(addDays(monday, 7)) : weekMondayIso;

  const effectiveSimulationId = optimisticSimulationId ?? simulationIdProp;

  const displayShifts = planningMode === "simulation" ? simulationShifts : shifts;
  const displayAlerts = planningMode === "simulation" ? simulationAlerts : planningAlerts;

  useEffect(() => {
    setPlanningMode(initialPlanningMode);
  }, [initialPlanningMode]);

  useEffect(() => {
    setOptimisticSimulationId(null);
  }, [weekMondayIso]);

  useEffect(() => {
    if (simulationIdProp && optimisticSimulationId && simulationIdProp === optimisticSimulationId) {
      setOptimisticSimulationId(null);
    }
  }, [simulationIdProp, optimisticSimulationId]);

  useEffect(() => {
    if (!monday || staff.length === 0) return;
    const t0 = new Date(monday);
    t0.setHours(9, 0, 0, 0);
    const t1 = new Date(monday);
    t1.setHours(17, 0, 0, 0);
    setShiftStart(formatDatetimeLocalFromDate(t0));
    setShiftEnd(formatDatetimeLocalFromDate(t1));
  }, [weekMondayIso, monday, staff.length]);

  function equipeWeekHref(weekYmd: string): string {
    const qs = new URLSearchParams();
    qs.set("week", weekYmd);
    if (planningMode === "simulation") qs.set("planning", "sim");
    return `/equipe?${qs.toString()}`;
  }

  function navigatePlanningMode(mode: PlanningMode) {
    setPlanningMode(mode);
    const qs = new URLSearchParams();
    qs.set("week", weekMondayIso);
    if (mode === "simulation") qs.set("planning", "sim");
    replaceEquipeUrl(`/equipe?${qs.toString()}`);
  }

  function refresh() {
    router.refresh();
  }

  function replaceEquipeUrl(href: string) {
    router.replace(href);
    router.refresh();
  }

  function addStaff() {
    setError(null);
    setSuccessMsg(null);
    start(async () => {
      const r = await createStaffMemberAction(restaurantId, {
        displayName: newName,
        roleLabel: newRole.trim() || null,
      });
      if (!r.ok) { setError(r.error); return; }
      setNewName("");
      setNewRole("");
      refresh();
    });
  }

  function deactivate(id: string) {
    if (!confirm("Retirer ce collaborateur de la liste active ? Les shifts passés restent en base.")) return;
    setError(null);
    setSuccessMsg(null);
    start(async () => {
      const r = await deactivateStaffMemberAction(restaurantId, id);
      if (!r.ok) { setError(r.error); return; }
      setExpandedStaffId(null);
      setInviteLink(null);
      refresh();
    });
  }

  function generateInviteLink(staffId: string) {
    setError(null);
    setSuccessMsg(null);
    setInviteLink(null);
    start(async () => {
      const r = await createStaffInviteAction(restaurantId, staffId);
      if (!r.ok) { setError(r.error); return; }
      const absolute = toAbsoluteInviteUrl(r.joinUrl);
      // Tentative d'auto-copie (peut échouer hors contexte sécurisé)
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(absolute);
          setSuccessMsg("Lien copié dans le presse-papiers. Valable 7 jours.");
        }
      } catch {
        // Ignore — le lien est affiché ci-dessous pour copie manuelle
      }
      setInviteLink(absolute);
    });
  }

  function linkMe(staffId: string) {
    setError(null);
    setSuccessMsg(null);
    start(async () => {
      const r = await linkMyAccountToStaffAction(restaurantId, staffId);
      if (!r.ok) { setError(r.error); return; }
      setSuccessMsg("Ce poste est maintenant lié à votre compte.");
      refresh();
    });
  }

  function unlinkStaff(staffId: string) {
    setError(null);
    start(async () => {
      const r = await clearStaffUserLinkAction(restaurantId, staffId);
      if (!r.ok) { setError(r.error); return; }
      refresh();
    });
  }

  function saveNavPermissions(staffId: string, keys: string[]) {
    setError(null);
    start(async () => {
      const r = await updateStaffNavPermissionsAction(restaurantId, staffId, keys);
      if (!r.ok) { setError(r.error); return; }
      refresh();
    });
  }

  function startWeekSimulation() {
    setError(null);
    setSuccessMsg(null);
    start(async () => {
      const r = await createWeekSimulationAction(restaurantId, weekMondayIso);
      if (!r.ok) { setError(r.error); return; }
      setOptimisticSimulationId(r.id);
      setPlanningMode("simulation");
      router.replace(`/equipe?week=${encodeURIComponent(weekMondayIso)}&planning=sim`);
    });
  }

  function runAutoSimulation() {
    if (staff.length === 0) {
      setError("Ajoutez au moins un collaborateur actif pour générer une ébauche.");
      return;
    }
    if (effectiveSimulationId) {
      if (!confirm("Remplacer tous les créneaux du brouillon par une nouvelle ébauche ?")) return;
    }
    setError(null);
    setSuccessMsg(null);
    start(async () => {
      const r = await generateAutoSimulationShiftsAction(restaurantId, weekMondayIso);
      if (!r.ok) { setError(r.error); return; }
      setOptimisticSimulationId(null);
      setPlanningMode("simulation");
      if (r.generatedCount === 0) {
        setSuccessMsg(
          "Aucun créneau généré : vérifiez les horaires d'ouverture, les objectifs d'effectif et les disponibilités."
        );
      } else {
        setSuccessMsg(
          `Ébauche générée : ${r.generatedCount} créneau${r.generatedCount === 1 ? "" : "x"} (modifiables avant publication).`
        );
      }
      router.replace(`/equipe?week=${encodeURIComponent(weekMondayIso)}&planning=sim`);
    });
  }

  function addShift() {
    setError(null);
    if (!shiftStaffId || !shiftStart || !shiftEnd) {
      setError("Choisissez un collaborateur et les horaires.");
      return;
    }
    if (planningMode === "simulation" && !effectiveSimulationId) {
      setError("Créez d'abord un brouillon pour cette semaine (bouton ci-dessus).");
      return;
    }
    start(async () => {
      const br = shiftBreakMinutes.trim();
      const payload = {
        staffMemberId: shiftStaffId,
        startsAtLocal: shiftStart,
        endsAtLocal: shiftEnd,
        notes: shiftNotes.trim() || null,
        breakMinutes: br === "" ? null : Number(br),
      };
      const r =
        planningMode === "simulation" && effectiveSimulationId
          ? await createSimulationShiftAction(restaurantId, effectiveSimulationId, payload)
          : await createWorkShiftAction(restaurantId, payload);
      if (!r.ok) { setError(r.error); return; }
      setShiftNotes("");
      if (planningMode === "simulation") {
        router.replace(`/equipe?week=${encodeURIComponent(weekMondayIso)}&planning=sim`);
      } else {
        refresh();
      }
    });
  }

  function publishSimulation() {
    if (!confirm("Publier cette ébauche ? Les créneaux réels de la semaine seront remplacés, puis le brouillon supprimé.")) return;
    setError(null);
    start(async () => {
      const r = await publishWeekSimulationAction(restaurantId, weekMondayIso);
      if (!r.ok) { setError(r.error); return; }
      setOptimisticSimulationId(null);
      setPlanningMode("real");
      setSuccessMsg(`Planning publié (${r.publishedCount} créneau${r.publishedCount === 1 ? "" : "x"}).`);
      router.replace(`/equipe?week=${encodeURIComponent(weekMondayIso)}`);
    });
  }

  function discardSimulation() {
    if (!confirm("Abandonner le brouillon ? Le planning réel reste inchangé.")) return;
    setError(null);
    start(async () => {
      const r = await discardWeekSimulationAction(restaurantId, weekMondayIso);
      if (!r.ok) { setError(r.error); return; }
      setOptimisticSimulationId(null);
      setPlanningMode("real");
      setSuccessMsg("Brouillon supprimé.");
      router.replace(`/equipe?week=${encodeURIComponent(weekMondayIso)}`);
    });
  }

  return (
    <div className="space-y-8">
      {successMsg ? <p className={uiSuccess}>{successMsg}</p> : null}
      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      )}

      {/* ── Planning ──────────────────────────────────────────────────────── */}
      <section className={uiCard}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Planning</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              className={planningMode === "real" ? `${uiBtnPrimarySm} ring-2 ring-indigo-300` : uiBtnOutlineSm}
              onClick={() => navigatePlanningMode("real")}
            >
              Planning réel
            </button>
            <button
              type="button"
              disabled={pending}
              className={planningMode === "simulation" ? `${uiBtnPrimarySm} ring-2 ring-amber-400` : uiBtnOutlineSm}
              onClick={() => navigatePlanningMode("simulation")}
            >
              Brouillon
            </button>
            {planningMode === "simulation" && effectiveSimulationId && (
              <>
                <button type="button" disabled={pending} className={uiBtnPrimarySm} onClick={publishSimulation}>
                  Publier
                </button>
                <button type="button" disabled={pending} className={uiBtnOutlineSm} onClick={discardSimulation}>
                  Abandonner
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          <Link
            href={`/restaurants/${restaurantId}/edit`}
            className="font-medium text-indigo-700 underline underline-offset-2"
          >
            Horaires, prépa hors client, objectifs et exceptions
          </Link>{" "}
          se règlent dans les infos du restaurant.
        </p>

        {/* Alertes */}
        <div className="mt-4">
          {displayAlerts.length > 0 ? (
            <ul className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-3 text-sm">
              {displayAlerts.map((a, i) => (
                <li
                  key={i}
                  className={
                    a.level === "error"
                      ? "text-red-900"
                      : a.level === "warning"
                        ? "text-amber-950"
                        : "text-slate-700"
                  }
                >
                  <span className="font-semibold">
                    {a.level === "error" ? "Erreur" : a.level === "warning" ? "Attention" : "Info"} :{" "}
                  </span>
                  {a.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-900">
              Aucune alerte sur cette semaine.
            </p>
          )}
        </div>

        {/* Ébauche de planning (mode brouillon uniquement) */}
        {planningMode === "simulation" && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={pending || staff.length === 0}
              className={uiBtnPrimarySm}
              onClick={runAutoSimulation}
            >
              Ébauche de planning
            </button>
            {!effectiveSimulationId && (
              <button type="button" disabled={pending} className={uiBtnOutlineSm} onClick={startWeekSimulation}>
                Brouillon vide
              </button>
            )}
          </div>
        )}

        {/* Grille */}
        <div className="mt-6 border-t border-slate-100 pt-6">
          <ManualWeekPlanner
            restaurantId={restaurantId}
            weekMondayIso={weekMondayIso}
            staff={staff}
            shifts={displayShifts}
            resolvedWeekDays={resolvedWeekDaysForGrid}
            isSimulation={planningMode === "simulation"}
            simulationId={effectiveSimulationId}
            pending={pending}
            onUpdated={refresh}
          />
          <PlanningHoursRecap
            staff={staff}
            shifts={displayShifts}
            weekMondayIso={weekMondayIso}
            restaurantId={restaurantId}
            pending={pending}
            showCarryoverActions={planningMode === "real"}
            onUpdated={refresh}
          />
        </div>
      </section>

      {/* ── Semaine affichée ──────────────────────────────────────────────── */}
      <section className={uiCard}>
        <h2 className="text-sm font-semibold text-slate-900">Semaine affichée</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href={equipeWeekHref(prevWeek)} className={`${uiBtnSecondary} text-sm`} scroll={false}>
            ← Semaine précédente
          </Link>
          <span className="text-sm font-medium text-slate-700">
            {monday
              ? `Du ${monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} au ${addDays(monday, 6).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
              : weekMondayIso}
          </span>
          <Link href={equipeWeekHref(nextWeek)} className={`${uiBtnSecondary} text-sm`} scroll={false}>
            Semaine suivante →
          </Link>
        </div>
      </section>

      {/* ── Collaborateurs ────────────────────────────────────────────────── */}
      <section className={uiCard}>
        <h2 className="text-sm font-semibold text-slate-900">Collaborateurs</h2>

        {/* Ajout */}
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className={`${uiInput} min-w-[10rem] flex-1`}
            placeholder="Nom"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className={`${uiInput} min-w-[8rem] flex-1`}
            placeholder="Poste (optionnel)"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
          />
          <button type="button" disabled={pending} className={uiBtnPrimarySm} onClick={addStaff}>
            Ajouter
          </button>
        </div>

        {/* Liste */}
        {staff.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Aucun collaborateur. Ajoutez-en au moins un pour planifier.</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {staff.map((m) => {
              const idx = (staffColorIndex.get(m.id) ?? 0) % STAFF_COLORS.length;
              const colorClass = STAFF_COLORS[idx];
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedStaffId(m.id)}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50 transition-colors"
                  >
                    <span className={`h-3 w-3 flex-none rounded-full ${colorClass}`} />
                    <span className="font-medium text-slate-900">{m.display_name}</span>
                    {m.role_label && (
                      <span className="text-xs text-slate-500">{m.role_label}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Nouveau créneau (replié par défaut) ──────────────────────────── */}
      <details className={uiCard}>
        <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">
          Ajouter un créneau manuellement
        </summary>

        {/* Saisie manuelle */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={uiLabel} htmlFor="shift-staff">Collaborateur</label>
            <select
              id="shift-staff"
              className={`${uiInput} mt-1 w-full`}
              value={shiftStaffId}
              onChange={(e) => setShiftStaffId(e.target.value)}
            >
              {staff.map((m) => (
                <option key={m.id} value={m.id}>{m.display_name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={uiLabel} htmlFor="shift-start">Début</label>
              <input
                id="shift-start"
                type="datetime-local"
                className={`${uiInput} mt-1 w-full`}
                value={shiftStart}
                onChange={(e) => setShiftStart(e.target.value)}
              />
            </div>
            <div>
              <label className={uiLabel} htmlFor="shift-end">Fin</label>
              <input
                id="shift-end"
                type="datetime-local"
                className={`${uiInput} mt-1 w-full`}
                value={shiftEnd}
                onChange={(e) => setShiftEnd(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={uiLabel} htmlFor="shift-break">Pause planifiée (min)</label>
            <input
              id="shift-break"
              type="number"
              min={0}
              max={600}
              step={5}
              className={`${uiInput} mt-1 w-full`}
              value={shiftBreakMinutes}
              onChange={(e) => setShiftBreakMinutes(e.target.value)}
              placeholder="ex. 30"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={uiLabel} htmlFor="shift-notes">Note (optionnel)</label>
            <input
              id="shift-notes"
              className={`${uiInput} mt-1 w-full`}
              value={shiftNotes}
              onChange={(e) => setShiftNotes(e.target.value)}
              placeholder="ex. Réception groupe"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={pending || staff.length === 0 || (planningMode === "simulation" && !effectiveSimulationId)}
          className={`${uiBtnPrimarySm} mt-3`}
          onClick={addShift}
        >
          {planningMode === "simulation" ? "Ajouter au brouillon" : "Ajouter le créneau"}
        </button>
      </details>

      {/* ── Tuile détail collaborateur ────────────────────────────────────── */}
      {expandedStaffId && (() => {
        const m = staff.find((s) => s.id === expandedStaffId);
        if (!m) return null;
        const idx = (staffColorIndex.get(m.id) ?? 0) % STAFF_COLORS.length;
        const colorClass = STAFF_COLORS[idx];
        return (
          <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Fermer"
              onClick={() => setExpandedStaffId(null)}
            />
            <div className={`relative z-10 ${uiCard} w-full max-w-lg shadow-xl overflow-y-auto max-h-[90vh]`}>
              {/* En-tête */}
              <div className="flex items-center gap-3">
                <span className={`h-4 w-4 flex-none rounded-full ${colorClass}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{m.display_name}</p>
                  {m.role_label && <p className="text-xs text-slate-500">{m.role_label}</p>}
                </div>
                <button
                  type="button"
                  className="ml-auto rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                  onClick={() => { setExpandedStaffId(null); setInviteLink(null); }}
                >
                  Fermer
                </button>
              </div>

              {/* Accès pages */}
              <NavPermissionsEditor
                member={m}
                pending={pending}
                onSave={(keys) => saveNavPermissions(m.id, keys)}
              />

              {/* Lier un compte */}
              <div className="mt-4 space-y-2">
                {!m.user_id ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        className={uiBtnOutlineSm}
                        onClick={() => generateInviteLink(m.id)}
                      >
                        Générer le lien d'invitation
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        className={uiBtnOutlineSm}
                        onClick={() => linkMe(m.id)}
                      >
                        C'est moi (ce poste)
                      </button>
                    </div>
                    {inviteLink && expandedStaffId === m.id && (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500">
                          Copiez ce lien et envoyez-le au collaborateur (valable 7 jours) :
                        </p>
                        <div className="flex gap-2">
                          <input
                            readOnly
                            value={inviteLink}
                            className={`${uiInput} flex-1 text-xs`}
                            onFocus={(e) => e.target.select()}
                          />
                          <button
                            type="button"
                            className={uiBtnOutlineSm}
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(inviteLink);
                                setSuccessMsg("Lien copié dans le presse-papiers.");
                              } catch {
                                setError("Copie impossible depuis ce navigateur — sélectionnez le lien et copiez-le manuellement.");
                              }
                            }}
                          >
                            Copier
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-emerald-700 font-medium">Compte lié</span>
                    {m.user_id === currentUserId ? (
                      <button type="button" disabled={pending} className={uiBtnOutlineSm} onClick={() => unlinkStaff(m.id)}>
                        Délier mon compte
                      </button>
                    ) : (
                      <button type="button" disabled={pending} className={uiBtnOutlineSm} onClick={() => unlinkStaff(m.id)}>
                        Retirer le compte lié
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Contrat / disponibilités */}
              <div className="mt-4 border-t border-slate-100 pt-4">
                <StaffPlanningProfileForm restaurantId={restaurantId} member={m} />
              </div>

              {/* Désactivation */}
              <div className="mt-4 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  onClick={() => deactivate(m.id)}
                >
                  Désactiver ce collaborateur
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
