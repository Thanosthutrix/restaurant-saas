"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { ManualWeekPlanner, PlanningHoursRecap } from "@/components/staff/ManualWeekPlanner";
import { PlanningMatrixView } from "@/components/staff/PlanningMatrixView";
import { uiBtnOutlineSm, uiBtnPrimarySm, uiCard, uiInput, uiLabel } from "@/components/ui/premium";
import type { WeekPlannerActions } from "@/lib/staff/weekPlannerActions";
import type { WeekResolvedDay } from "@/lib/staff/planningResolve";
import type { StaffMember, WorkShiftWithDetails } from "@/lib/staff/types";
import { addDays, parseISODateLocal } from "@/lib/staff/weekUtils";
import {
  applyPlatformWeekDeltaAction,
  createPlatformStaffMemberAction,
  createPlatformWorkShiftAction,
  deactivatePlatformStaffMemberAction,
  deletePlatformWorkShiftAction,
  setPlatformStaffPlanningProfileAction,
  updatePlatformWorkShiftTimesAction,
} from "./actions";
import type { PlatformStaffMember } from "@/lib/platform/platformStaffDb";
import { nextWeekYmd, prevWeekYmd, weekNavigationHref } from "@/lib/platform/platformPlanningResolve";

type Props = {
  companyId: string;
  weekMondayIso: string;
  staff: StaffMember[];
  platformStaff: PlatformStaffMember[];
  shifts: WorkShiftWithDetails[];
  resolvedWeekDays: WeekResolvedDay[];
  securityFloor: number;
};

export function PlatformEquipePlanningClient({
  companyId,
  weekMondayIso,
  staff,
  platformStaff,
  shifts,
  resolvedWeekDays,
  securityFloor,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);

  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newTargetHours, setNewTargetHours] = useState("");

  const monday = useMemo(() => parseISODateLocal(weekMondayIso), [weekMondayIso]);
  const weekLabelFr = useMemo(() => {
    if (!monday) return weekMondayIso;
    return `Du ${monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} au ${addDays(monday, 6).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;
  }, [monday, weekMondayIso]);

  const plannerActions: WeekPlannerActions = useMemo(
    () => ({
      updateShiftTimes: (shiftId, payload) => updatePlatformWorkShiftTimesAction(shiftId, payload),
      createShift: (payload) => createPlatformWorkShiftAction(payload),
      deleteShift: (shiftId) => deletePlatformWorkShiftAction(shiftId),
      applyWeekDelta: async (week) => {
        const r = await applyPlatformWeekDeltaAction(week);
        if (!r.ok) return r;
        return { ok: true as const, updated: r.data!.updated };
      },
    }),
    []
  );

  function refresh() {
    router.refresh();
  }

  function addStaff() {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const target = newTargetHours.trim() ? Number(newTargetHours.replace(",", ".")) : null;
      const r = await createPlatformStaffMemberAction({
        displayName: newName,
        roleLabel: newRole.trim() || null,
        targetWeeklyHours: target != null && Number.isFinite(target) ? target : null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setNewName("");
      setNewRole("");
      setNewTargetHours("");
      setSuccessMsg("Collaborateur ajouté.");
      refresh();
    });
  }

  function deactivate(id: string, name: string) {
    if (!confirm(`Retirer ${name} de l'équipe active ?`)) return;
    setError(null);
    startTransition(async () => {
      const r = await deactivatePlatformStaffMemberAction(id);
      if (!r.ok) setError(r.error);
      else refresh();
    });
  }

  return (
    <div className="space-y-8">
      {successMsg ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{successMsg}</p> : null}
      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}

      <section className={uiCard}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-stone-900">Planning</h2>
          <div className="flex items-center gap-2">
            <Link href={weekNavigationHref(prevWeekYmd(weekMondayIso))} className={uiBtnOutlineSm} aria-label="Semaine précédente">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="text-xs font-medium text-stone-600">{weekLabelFr}</span>
            <Link href={weekNavigationHref(nextWeekYmd(weekMondayIso))} className={uiBtnOutlineSm} aria-label="Semaine suivante">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <p className="mt-2 text-xs text-stone-500">
          Glissez et redimensionnez les créneaux comme dans le planning restaurateur. Les horaires bureau se configurent
          dans la section ci-dessus.
        </p>

        <div className="mt-6 border-t border-stone-100 pt-6">
          {staff.length === 0 ? (
            <p className="mb-4 rounded-xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
              Ajoutez d&apos;abord un collaborateur ci-dessous pour planifier la semaine.
            </p>
          ) : (
            <>
              <ManualWeekPlanner
                restaurantId={companyId}
                weekMondayIso={weekMondayIso}
                staff={staff}
                shifts={shifts}
                resolvedWeekDays={resolvedWeekDays}
                isSimulation={false}
                simulationId={null}
                pending={pending}
                onUpdated={refresh}
                actions={plannerActions}
              />
              <PlanningHoursRecap
                staff={staff}
                shifts={shifts}
                weekMondayIso={weekMondayIso}
                restaurantId={companyId}
                pending={pending}
                showCarryoverActions
                onUpdated={refresh}
                applyWeekDelta={async (week) => {
                  const r = await applyPlatformWeekDeltaAction(week);
                  if (!r.ok) return r;
                  return { ok: true as const, updated: r.data!.updated };
                }}
              />
              <div className="mt-4 space-y-3">
                <button type="button" onClick={() => setShowMatrix((v) => !v)} className={uiBtnOutlineSm}>
                  {showMatrix ? "Masquer la vue matrice" : "Vue matrice (présence par tranche)"}
                </button>
                {showMatrix ? (
                  <PlanningMatrixView
                    shifts={shifts}
                    staff={staff}
                    resolvedWeekDays={resolvedWeekDays}
                    securityFloor={securityFloor}
                  />
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>

      <section className={uiCard}>
        <h2 className="text-sm font-semibold text-stone-900">Collaborateurs</h2>
        {platformStaff.length > 0 ? (
          <ul className="mt-4 divide-y divide-stone-100 rounded-xl border border-stone-100">
            {platformStaff.map((m) => (
              <StaffRow
                key={m.id}
                member={m}
                pending={pending}
                onDeactivate={() => deactivate(m.id, m.display_name)}
                onSaved={refresh}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm italic text-stone-400">Aucun collaborateur actif.</p>
        )}

        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addStaff();
          }}
        >
          <label className="min-w-[10rem] flex-1">
            <span className={uiLabel}>Nom</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className={`${uiInput} mt-1 w-full`}
            />
          </label>
          <label className="min-w-[8rem] flex-1">
            <span className={uiLabel}>Poste</span>
            <input value={newRole} onChange={(e) => setNewRole(e.target.value)} className={`${uiInput} mt-1 w-full`} />
          </label>
          <label className="w-24">
            <span className={uiLabel}>h/sem.</span>
            <input
              value={newTargetHours}
              onChange={(e) => setNewTargetHours(e.target.value)}
              placeholder="35"
              className={`${uiInput} mt-1 w-full`}
            />
          </label>
          <button type="submit" disabled={pending} className={uiBtnPrimarySm}>
            Ajouter
          </button>
        </form>
      </section>
    </div>
  );
}

function StaffRow({
  member,
  pending,
  onDeactivate,
  onSaved,
}: {
  member: PlatformStaffMember;
  pending: boolean;
  onDeactivate: () => void;
  onSaved: () => void;
}) {
  const [rate, setRate] = useState(member.hourly_gross_rate != null ? String(member.hourly_gross_rate) : "");
  const [target, setTarget] = useState(
    member.target_weekly_hours != null ? String(member.target_weekly_hours) : ""
  );
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-3 text-sm">
      <div className="min-w-[8rem] flex-1">
        <p className="font-medium text-stone-900">{member.display_name}</p>
        {member.role_label ? <p className="text-xs text-stone-400">{member.role_label}</p> : null}
      </div>
      <input
        value={rate}
        onChange={(e) => setRate(e.target.value)}
        placeholder="€/h"
        className="w-20 rounded-lg border border-stone-200 px-2 py-1.5 text-sm"
      />
      <input
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="h/sem."
        className="w-20 rounded-lg border border-stone-200 px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        disabled={pending}
        className="text-xs font-medium text-amber-800 hover:underline"
        onClick={() => {
          setMsg(null);
          const hourly = rate.trim() ? Number(rate.replace(",", ".")) : null;
          const weekly = target.trim() ? Number(target.replace(",", ".")) : null;
          void setPlatformStaffPlanningProfileAction({
            staffMemberId: member.id,
            hourlyGrossRate: hourly != null && Number.isFinite(hourly) ? hourly : null,
            targetWeeklyHours: weekly != null && Number.isFinite(weekly) ? weekly : null,
          }).then((r) => {
            if (!r.ok) setMsg(r.error);
            else {
              setMsg("Enregistré");
              onSaved();
            }
          });
        }}
      >
        Enregistrer
      </button>
      <button type="button" disabled={pending} onClick={onDeactivate} className="text-stone-400 hover:text-red-600" aria-label="Retirer">
        <Trash2 className="h-4 w-4" />
      </button>
      {msg ? <span className="text-xs text-stone-500">{msg}</span> : null}
    </li>
  );
}
