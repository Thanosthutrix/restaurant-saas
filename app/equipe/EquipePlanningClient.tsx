"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { StaffPlanningProfileForm } from "@/components/staff/StaffPlanningProfileForm";
import { WeekScheduleOverview } from "@/components/staff/WeekScheduleOverview";
import type { PlanningAlert } from "@/lib/staff/planningAlerts";
import type { WeekResolvedDay } from "@/lib/staff/planningResolve";
import type { StaffMember, WorkShiftWithDetails } from "@/lib/staff/types";
import {
  actualDurationMinutes,
  formatMinutesHuman,
  plannedDurationMinutes,
  varianceMinutes,
} from "@/lib/staff/timeHelpers";
import { addDays, parseISODateLocal, toISODateString } from "@/lib/staff/weekUtils";
import { APP_ROLES } from "@/lib/auth/appRoles";
import {
  clearStaffUserLinkAction,
  createSimulationShiftAction,
  createStaffInviteAction,
  createStaffMemberAction,
  createWeekSimulationAction,
  createWorkShiftAction,
  deactivateStaffMemberAction,
  deleteSimulationShiftAction,
  deleteWorkShiftAction,
  discardWeekSimulationAction,
  generateAutoSimulationShiftsAction,
  linkMyAccountToStaffAction,
  managerSetAttendanceAction,
  publishWeekSimulationAction,
  updateStaffAppRoleAction,
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

/** Lien utilisable dans un mail / SMS (le serveur peut renvoyer un chemin relatif si pas d’URL publique en env). */
function toAbsoluteInviteUrl(joinUrlFromServer: string): string {
  const t = joinUrlFromServer.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (typeof window === "undefined") return t;
  const path = t.startsWith("/") ? t : `/${t}`;
  return `${window.location.origin}${path}`;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback ci-dessous */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function formatDateTimeFr(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const APP_ROLE_LABELS_FR: Record<(typeof APP_ROLES)[number], string> = {
  manager: "Complet (toutes les sections)",
  service: "Salle, caisse, plats, services",
  cuisine: "Cuisine, stock, préparations",
  hygiene: "Hygiène / nettoyage",
  achats: "Achats, fournisseurs, livraison, commandes",
  lecture_seule: "Lecture (dashboard + compte)",
};

type PlanningMode = "real" | "simulation";

type Props = {
  restaurantId: string;
  currentUserId: string;
  weekMondayIso: string;
  /** Dérivé de l’URL ?planning=sim pour garder le mode après navigation / refresh. */
  initialPlanningMode: PlanningMode;
  staff: StaffMember[];
  shifts: WorkShiftWithDetails[];
  simulationId: string | null;
  simulationShifts: WorkShiftWithDetails[];
  resolvedWeekDays: WeekResolvedDay[];
  planningAlerts: PlanningAlert[];
  simulationAlerts: PlanningAlert[];
};

function formatDatetimeLocalFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

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
  planningAlerts,
  simulationAlerts,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [planningMode, setPlanningMode] = useState<PlanningMode>(initialPlanningMode);
  /** Si le serveur renvoie encore simulationId=null après création (cache), on garde l’UUID renvoyé par l’action. */
  const [optimisticSimulationId, setOptimisticSimulationId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");

  const [shiftStaffId, setShiftStaffId] = useState(staff[0]?.id ?? "");
  const [shiftStart, setShiftStart] = useState("");
  const [shiftEnd, setShiftEnd] = useState("");
  const [shiftNotes, setShiftNotes] = useState("");
  const [shiftBreakMinutes, setShiftBreakMinutes] = useState("");

  const [editShiftId, setEditShiftId] = useState<string | null>(null);
  const [editIn, setEditIn] = useState("");
  const [editOut, setEditOut] = useState("");

  const monday = useMemo(() => parseISODateLocal(weekMondayIso), [weekMondayIso]);
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

  /** Horaires par défaut (lundi 9h–17h) pour pouvoir ajouter un créneau sans étape invisible. */
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

  /** Mise à jour d’URL sur /equipe + refetch des Server Components (sans F5). */
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
      if (!r.ok) {
        setError(r.error);
        return;
      }
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
      if (!r.ok) {
        setError(r.error);
        return;
      }
      refresh();
    });
  }

  function copyInviteLink(staffId: string) {
    setError(null);
    setSuccessMsg(null);
    start(async () => {
      const r = await createStaffInviteAction(restaurantId, staffId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const absolute = toAbsoluteInviteUrl(r.joinUrl);
      const copied = await copyTextToClipboard(absolute);
      if (!copied) {
        setError(`Copie automatique impossible. Sélectionnez et copiez ce lien : ${absolute}`);
        return;
      }
      setSuccessMsg(
        "Lien copié dans le presse-papiers. Envoyez-le au collaborateur (e-mail, SMS…). Il est valable 7 jours."
      );
    });
  }

  function linkMe(staffId: string) {
    setError(null);
    setSuccessMsg(null);
    start(async () => {
      const r = await linkMyAccountToStaffAction(restaurantId, staffId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSuccessMsg("Ce poste est maintenant lié à votre compte (planning, rôle applicatif ci-dessus).");
      refresh();
    });
  }

  function unlinkStaff(staffId: string) {
    setError(null);
    start(async () => {
      const r = await clearStaffUserLinkAction(restaurantId, staffId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      refresh();
    });
  }

  function saveAppRole(staffId: string, value: string) {
    setError(null);
    start(async () => {
      const r = await updateStaffAppRoleAction(restaurantId, staffId, value);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      refresh();
    });
  }

  function startWeekSimulation() {
    setError(null);
    setSuccessMsg(null);
    start(async () => {
      const r = await createWeekSimulationAction(restaurantId, weekMondayIso);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOptimisticSimulationId(r.id);
      setPlanningMode("simulation");
      router.replace(`/equipe?week=${encodeURIComponent(weekMondayIso)}&planning=sim`);
    });
  }

  function runAutoSimulation() {
    if (staff.length === 0) {
      setError("Ajoutez au moins un collaborateur actif pour lancer une génération automatique.");
      return;
    }
    if (effectiveSimulationId) {
      if (
        !confirm(
          "Remplacer tous les créneaux du brouillon par une nouvelle proposition calculée (horaires restaurant + effectifs + dispos équipe) ?"
        )
      ) {
        return;
      }
    }
    setError(null);
    setSuccessMsg(null);
    start(async () => {
      const r = await generateAutoSimulationShiftsAction(restaurantId, weekMondayIso);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOptimisticSimulationId(null);
      setPlanningMode("simulation");
      if (r.generatedCount === 0) {
        setSuccessMsg(
          "Aucun créneau généré : vérifiez les horaires d’ouverture (jours ouverts), les objectifs d’effectif et les disponibilités dans les fiches équipe."
        );
      } else {
        setSuccessMsg(
          `Proposition automatique : ${r.generatedCount} créneau${r.generatedCount === 1 ? "" : "x"} (modifiables avant publication).`
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
      setError("Créez d’abord une simulation pour cette semaine (bouton ci-dessus).");
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
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setShiftNotes("");
      if (planningMode === "simulation") {
        router.replace(`/equipe?week=${encodeURIComponent(weekMondayIso)}&planning=sim`);
      } else {
        refresh();
      }
    });
  }

  function removeShift(s: WorkShiftWithDetails) {
    if (!confirm("Supprimer ce créneau ?")) return;
    setError(null);
    start(async () => {
      const r = s.isSimulationDraft
        ? await deleteSimulationShiftAction(restaurantId, s.id)
        : await deleteWorkShiftAction(restaurantId, s.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (planningMode === "simulation") {
        router.replace(`/equipe?week=${encodeURIComponent(weekMondayIso)}&planning=sim`);
      } else {
        refresh();
      }
    });
  }

  function publishSimulation() {
    if (
      !confirm(
        "Publier cette simulation ? Les créneaux réels de la semaine seront remplacés par le brouillon, puis le brouillon sera supprimé."
      )
    ) {
      return;
    }
    setError(null);
    start(async () => {
      const r = await publishWeekSimulationAction(restaurantId, weekMondayIso);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOptimisticSimulationId(null);
      setPlanningMode("real");
      setSuccessMsg(`Planning publié (${r.publishedCount} créneau${r.publishedCount === 1 ? "" : "x"}).`);
      router.replace(`/equipe?week=${encodeURIComponent(weekMondayIso)}`);
    });
  }

  function discardSimulation() {
    if (!confirm("Abandonner la simulation ? Le brouillon sera supprimé sans modifier le planning réel.")) return;
    setError(null);
    start(async () => {
      const r = await discardWeekSimulationAction(restaurantId, weekMondayIso);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOptimisticSimulationId(null);
      setPlanningMode("real");
      setSuccessMsg("Simulation abandonnée.");
      router.replace(`/equipe?week=${encodeURIComponent(weekMondayIso)}`);
    });
  }

  function openEditAttendance(s: WorkShiftWithDetails) {
    setEditShiftId(s.id);
    setEditIn(s.attendance?.clock_in_at ? toDatetimeLocalValue(s.attendance.clock_in_at) : "");
    setEditOut(s.attendance?.clock_out_at ? toDatetimeLocalValue(s.attendance.clock_out_at) : "");
  }

  function parseLocalDateTimeInputClient(s: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s.trim());
    if (!m) throw new Error("invalid");
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      0,
      0
    ).toISOString();
  }

  function saveAttendance() {
    if (!editShiftId) return;
    setError(null);
    start(async () => {
      let inIso: string | null = null;
      let outIso: string | null = null;
      try {
        if (editIn.trim()) inIso = parseLocalDateTimeInputClient(editIn);
        if (editOut.trim()) outIso = parseLocalDateTimeInputClient(editOut);
      } catch {
        setError("Format attendu : AAAA-MM-JJTHH:mm pour chaque champ renseigné.");
        return;
      }

      const r = await managerSetAttendanceAction(restaurantId, editShiftId, inIso, outIso);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEditShiftId(null);
      refresh();
    });
  }

  return (
    <div className="space-y-8">
      {successMsg ? <p className={uiSuccess}>{successMsg}</p> : null}
      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      )}

      <section className={`${uiCard}`}>
        <h2 className="text-sm font-semibold text-slate-900">Vue semaine & alertes</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600">Affichage :</span>
          <button
            type="button"
            disabled={pending}
            className={
              planningMode === "real"
                ? `${uiBtnPrimarySm} ring-2 ring-indigo-300`
                : uiBtnOutlineSm
            }
            onClick={() => navigatePlanningMode("real")}
          >
            Planning réel
          </button>
          <button
            type="button"
            disabled={pending}
            className={
              planningMode === "simulation"
                ? `${uiBtnPrimarySm} ring-2 ring-amber-400`
                : uiBtnOutlineSm
            }
            onClick={() => navigatePlanningMode("simulation")}
          >
            Simulation
          </button>
        </div>
        {planningMode === "simulation" ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
            <strong className="font-semibold">Mode simulation</strong> — les créneaux ci-dessous sont un brouillon par
            semaine. Ils ne remplacent le planning publié qu’après « Publier ». Pas de pointage sur le brouillon.
            {effectiveSimulationId ? (
              <span className="ml-1 inline-flex flex-wrap items-center gap-2">
                <button type="button" disabled={pending} className={uiBtnPrimarySm} onClick={publishSimulation}>
                  Publier la simulation
                </button>
                <button type="button" disabled={pending} className={uiBtnOutlineSm} onClick={discardSimulation}>
                  Abandonner
                </button>
              </span>
            ) : (
              <span className="mt-2 block text-xs">
                Aucun brouillon pour cette semaine — utilisez « Démarrer une simulation » dans la section créneaux.
              </span>
            )}
          </div>
        ) : simulationIdProp || optimisticSimulationId ? (
          <p className="mt-2 text-xs text-slate-600">
            Un <strong className="font-medium text-slate-800">brouillon de simulation</strong> existe pour cette semaine.
            Passez en « Simulation » pour le modifier ou le publier.
          </p>
        ) : null}
        <p className="mt-1 text-xs text-slate-500">
          Grille : ouverture (vert) vs créneaux planifiés (bleu). Les alertes listent chevauchements, écarts aux
          horaires d’ouverture (modèle + exceptions), volumes vs objectif, pauses longues journées, retards de
          pointage.
        </p>
        <p className="mt-2 text-xs text-slate-600">
          <Link
            href={`/restaurants/${restaurantId}/edit`}
            className="font-medium text-indigo-700 underline underline-offset-2"
          >
            Horaires, objectifs d’effectif et exceptions (fériés, vacances)
          </Link>{" "}
          se règlent dans les infos du restaurant.
        </p>
        <div className="mt-4">
          <WeekScheduleOverview
            weekMondayIso={weekMondayIso}
            staff={staff}
            shifts={displayShifts}
            resolvedWeekDays={resolvedWeekDays}
            alerts={displayAlerts}
          />
        </div>
      </section>

      <section className={`${uiCard}`}>
        <h2 className="text-sm font-semibold text-slate-900">Semaine affichée</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href={equipeWeekHref(prevWeek)}
            className={`${uiBtnSecondary} text-sm`}
            scroll={false}
          >
            ← Semaine précédente
          </Link>
          <span className="text-sm font-medium text-slate-700">
            {monday
              ? `Du ${monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} au ${addDays(monday, 6).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
              : weekMondayIso}
          </span>
          <Link
            href={equipeWeekHref(nextWeek)}
            className={`${uiBtnSecondary} text-sm`}
            scroll={false}
          >
            Semaine suivante →
          </Link>
        </div>
      </section>

      <section className={`${uiCard}`}>
        <h2 className="text-sm font-semibold text-slate-900">Collaborateurs</h2>
        <p className="mt-1 text-xs text-slate-500">
          Le <strong className="font-medium text-slate-700">rôle applicatif</strong> règle le menu une fois le compte
          lié. Pour <strong className="font-medium text-slate-700">lier un compte</strong> : soit vous envoyez un{" "}
          <strong className="font-medium text-slate-700">lien d’invitation</strong> à la bonne personne (elle ouvre le
          lien, se connecte et accepte), soit c’est vous qui occupez ce poste sur cet appareil — utilisez alors{" "}
          <strong className="font-medium text-slate-700">« C’est moi (ce poste) »</strong>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className={`${uiInput} min-w-[10rem] flex-1`}
            placeholder="Nom"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className={`${uiInput} min-w-[8rem] flex-1`}
            placeholder="Rôle (optionnel)"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
          />
          <button type="button" disabled={pending} className={uiBtnPrimarySm} onClick={addStaff}>
            Ajouter
          </button>
        </div>
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
          {staff.length === 0 ? (
            <li className="px-3 py-4 text-sm text-slate-500">Aucun collaborateur. Ajoutez-en au moins un pour planifier.</li>
          ) : (
            staff.map((m) => (
              <li key={m.id} className="px-3 py-3 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-slate-900">{m.display_name}</span>
                  {m.role_label ? (
                    <span className="text-slate-500"> · {m.role_label}</span>
                  ) : null}
                  <span className="ml-2 text-xs text-slate-400">
                    {m.user_id ? "Compte lié" : "Pas de compte lié"}
                  </span>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`app-role-${m.id}`}>
                      Rôle applicatif pour {m.display_name}
                    </label>
                    <select
                      id={`app-role-${m.id}`}
                      className={`${uiInput} max-w-[min(100%,20rem)] text-xs`}
                      value={m.app_role ?? "lecture_seule"}
                      disabled={pending}
                      onChange={(e) => saveAppRole(m.id, e.target.value)}
                    >
                      {APP_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {APP_ROLE_LABELS_FR[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {!m.user_id ? (
                    <>
                      <button
                        type="button"
                        disabled={pending}
                        className={uiBtnOutlineSm}
                        onClick={() => copyInviteLink(m.id)}
                        title="Copie un lien à envoyer à quelqu’un d’autre pour qu’il associe son compte à cette fiche"
                      >
                        Lien d’invitation
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        className={uiBtnOutlineSm}
                        onClick={() => linkMe(m.id)}
                        title="À utiliser si vous êtes cette personne : lie cette fiche à votre session actuelle"
                      >
                        C’est moi (ce poste)
                      </button>
                    </>
                  ) : m.user_id === currentUserId ? (
                    <button
                      type="button"
                      disabled={pending}
                      className={uiBtnOutlineSm}
                      onClick={() => unlinkStaff(m.id)}
                    >
                      Délier mon compte
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      className={uiBtnOutlineSm}
                      onClick={() => unlinkStaff(m.id)}
                    >
                      Retirer le compte
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    onClick={() => deactivate(m.id)}
                  >
                    Désactiver
                  </button>
                </div>
                </div>
                <details className="mt-2 rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-1">
                  <summary className="cursor-pointer text-xs font-medium text-indigo-800">
                    Contrat, volume cible, disponibilités…
                  </summary>
                  <StaffPlanningProfileForm restaurantId={restaurantId} member={m} />
                </details>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className={`${uiCard}`}>
        <h2 className="text-sm font-semibold text-slate-900">Nouveau créneau</h2>
        {planningMode === "simulation" ? (
          <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <p className="font-medium text-slate-800">Brouillon de la semaine</p>
            <p className="text-xs text-slate-600">
              <strong className="font-medium text-slate-700">Génération automatique</strong> : utilise les plages
              d’ouverture (et exceptions) du restaurant, l’objectif <strong className="font-medium text-slate-700">nombre
              de personnes pour la journée</strong> (réparti entre les services du jour, pas répété à chaque plage), les{" "}
              <strong className="font-medium text-slate-700">disponibilités</strong> et volumes cibles des fiches
              équipe. Chaque créneau est l’intersection ouverture × disponibilité. Ajustez ou publiez ensuite.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={pending || staff.length === 0}
                className={uiBtnPrimarySm}
                onClick={runAutoSimulation}
              >
                {effectiveSimulationId ? "Régénérer automatiquement" : "Simulation automatique (restaurant + équipe)"}
              </button>
              {!effectiveSimulationId ? (
                <button type="button" disabled={pending} className={uiBtnOutlineSm} onClick={startWeekSimulation}>
                  Brouillon vide (sans auto)
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={uiLabel} htmlFor="shift-staff">
              Collaborateur
            </label>
            <select
              id="shift-staff"
              className={`${uiInput} mt-1 w-full`}
              value={shiftStaffId}
              onChange={(e) => setShiftStaffId(e.target.value)}
            >
              {staff.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={uiLabel} htmlFor="shift-start">
                Début
              </label>
              <input
                id="shift-start"
                type="datetime-local"
                className={`${uiInput} mt-1 w-full`}
                value={shiftStart}
                onChange={(e) => setShiftStart(e.target.value)}
              />
            </div>
            <div>
              <label className={uiLabel} htmlFor="shift-end">
                Fin
              </label>
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
            <label className={uiLabel} htmlFor="shift-break">
              Pause planifiée (min)
            </label>
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
            <label className={uiLabel} htmlFor="shift-notes">
              Note (optionnel)
            </label>
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
          disabled={
            pending ||
            staff.length === 0 ||
            (planningMode === "simulation" && !effectiveSimulationId)
          }
          className={`${uiBtnPrimarySm} mt-3`}
          onClick={addShift}
        >
          {planningMode === "simulation" ? "Ajouter au brouillon" : "Ajouter le créneau"}
        </button>
      </section>

      <section className={`${uiCard}`}>
        <h2 className="text-sm font-semibold text-slate-900">
          {planningMode === "simulation" ? "Brouillon (simulation)" : "Planning & pointages"}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {planningMode === "simulation" ? (
            <>
              Créneaux du brouillon pour la semaine affichée. Publiez pour les appliquer au planning réel et activer les
              pointages.
            </>
          ) : (
            <>
              Prévu = créneau saisi (pause déduite pour l’affichage du libellé d’alerte). Réalisé = entrée / sortie.
              Écart = durée pointée − durée prévue.
            </>
          )}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Collaborateur</th>
                <th className="px-2 py-2">Prévu</th>
                <th className="px-2 py-2">Pause</th>
                <th className="px-2 py-2">Pointé</th>
                <th className="px-2 py-2">Écart</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayShifts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-6 text-center text-slate-500">
                    {planningMode === "simulation"
                      ? effectiveSimulationId
                        ? "Aucun créneau dans le brouillon."
                        : "Aucun brouillon — démarrez une simulation ci-dessus."
                      : "Aucun créneau cette semaine."}
                  </td>
                </tr>
              ) : (
                displayShifts.map((s) => {
                  const planned = plannedDurationMinutes(s.starts_at, s.ends_at);
                  const actual = actualDurationMinutes(
                    s.attendance?.clock_in_at ?? null,
                    s.attendance?.clock_out_at ?? null
                  );
                  const varMin = varianceMinutes(planned, actual);
                  return (
                    <tr key={s.id} className="align-top">
                      <td className="px-2 py-2">
                        {s.isSimulationDraft ? (
                          <span className="mb-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                            Brouillon
                          </span>
                        ) : null}
                        <div className="font-medium text-slate-900">{s.staff_display_name}</div>
                        {s.staff_role_label ? (
                          <div className="text-xs text-slate-500">{s.staff_role_label}</div>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 tabular-nums text-slate-700">
                        <div>{formatDateTimeFr(s.starts_at)}</div>
                        <div className="text-slate-500">→ {formatDateTimeFr(s.ends_at)}</div>
                        <div className="text-xs text-slate-400">({formatMinutesHuman(planned)})</div>
                      </td>
                      <td className="px-2 py-2 tabular-nums text-slate-600">
                        {s.break_minutes != null && s.break_minutes > 0 ? `${s.break_minutes} min` : "—"}
                      </td>
                      <td className="px-2 py-2 tabular-nums text-slate-700">
                        {s.attendance?.clock_in_at ? (
                          <>
                            <div>Entrée {formatDateTimeFr(s.attendance.clock_in_at)}</div>
                            {s.attendance.clock_out_at ? (
                              <div>Sortie {formatDateTimeFr(s.attendance.clock_out_at)}</div>
                            ) : (
                              <div className="text-amber-700">Sortie non pointée</div>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {varMin == null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span
                            className={
                              varMin === 0
                                ? "text-slate-600"
                                : varMin > 0
                                  ? "text-amber-800"
                                  : "text-indigo-800"
                            }
                          >
                            {formatMinutesHuman(varMin)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {!s.isSimulationDraft ? (
                            <button
                              type="button"
                              className={uiBtnOutlineSm}
                              onClick={() => openEditAttendance(s)}
                            >
                              Ajuster pointage
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="text-xs font-semibold text-rose-700 hover:underline"
                            onClick={() => removeShift(s)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editShiftId && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fermer"
            onClick={() => setEditShiftId(null)}
          />
          <div className={`relative z-10 ${uiCard} w-full max-w-md shadow-xl`}>
            <h3 className="text-sm font-semibold text-slate-900">Ajuster le pointage (gérant)</h3>
            <p className="mt-1 text-xs text-slate-500">Laissez vide pour effacer une valeur.</p>
            <div className="mt-3 space-y-3">
              <div>
                <label className={uiLabel} htmlFor="edit-in">
                  Entrée
                </label>
                <input
                  id="edit-in"
                  type="datetime-local"
                  className={`${uiInput} mt-1 w-full`}
                  value={editIn}
                  onChange={(e) => setEditIn(e.target.value)}
                />
              </div>
              <div>
                <label className={uiLabel} htmlFor="edit-out">
                  Sortie
                </label>
                <input
                  id="edit-out"
                  type="datetime-local"
                  className={`${uiInput} mt-1 w-full`}
                  value={editOut}
                  onChange={(e) => setEditOut(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={pending} className={uiBtnPrimarySm} onClick={saveAttendance}>
                Enregistrer
              </button>
              <button
                type="button"
                className={uiBtnSecondary}
                onClick={() => setEditShiftId(null)}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
