"use client";

import { useState, useTransition } from "react";
import type { ReservationCapacitySettings } from "@/lib/reservations/capacitySettings";
import type { ResolvedCapacityLimits } from "@/lib/reservations/tableCapacity";
import { updateReservationCapacitySettingsAction } from "./actions";
import { uiLabel } from "@/components/ui/premium";

type Props = {
  initial: ReservationCapacitySettings;
  limits: ResolvedCapacityLimits;
};

export function ReservationCapacitySettingsForm({ initial, limits }: Props) {
  const [onlineEnabled, setOnlineEnabled] = useState(initial.online_reservations_enabled);
  const [duration, setDuration] = useState(String(initial.default_duration_minutes));
  const [slotStep, setSlotStep] = useState(String(initial.slot_step_minutes));
  const [minLead, setMinLead] = useState(String(initial.min_lead_minutes));
  const [maxCovers, setMaxCovers] = useState(
    initial.max_covers_per_slot != null ? String(initial.max_covers_per_slot) : ""
  );
  const [maxOnlineCovers, setMaxOnlineCovers] = useState(
    initial.max_online_covers_per_slot != null ? String(initial.max_online_covers_per_slot) : ""
  );
  const [onlineShare, setOnlineShare] = useState(String(initial.online_share_pct));
  const [maxPartyOnline, setMaxPartyOnline] = useState(String(initial.max_party_size_online));
  const [useTableCapacity, setUseTableCapacity] = useState(initial.use_table_capacity);
  const [notifyEmail, setNotifyEmail] = useState(initial.reservation_notify_email ?? "");
  const [enforceOnline, setEnforceOnline] = useState(initial.enforce_availability_online);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateReservationCapacitySettingsAction({
        onlineReservationsEnabled: onlineEnabled,
        defaultDurationMinutes: Number(duration),
        slotStepMinutes: Number(slotStep) as 15 | 30,
        minLeadMinutes: Number(minLead),
        maxCoversPerSlot: maxCovers.trim() ? Number(maxCovers) : null,
        maxOnlineCoversPerSlot: maxOnlineCovers.trim() ? Number(maxOnlineCovers) : null,
        onlineSharePct: Number(onlineShare),
        maxPartySizeOnline: Number(maxPartyOnline),
        useTableCapacity,
        reservationNotifyEmail: notifyEmail.trim() || null,
        enforceAvailabilityOnline: enforceOnline,
      });
      if (!res.ok) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">
        Capacité calculée depuis votre plan de salle :{" "}
        <strong>{limits.seating.tableCount} tables</strong>,{" "}
        <strong>{limits.seating.sumTableCapacity} couverts</strong> au total
        {limits.seating.mergeGroupCount > 0 ? (
          <> · {limits.seating.mergeGroupCount} fusion(s) configurée(s)</>
        ) : null}
        . Plafond effectif : <strong>{limits.maxCoversPerSlot} couverts/créneau</strong>, dont{" "}
        <strong>{limits.maxOnlineCoversPerSlot} en ligne</strong> (site + Meta).
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlineEnabled}
          onChange={(e) => setOnlineEnabled(e.target.checked)}
          className="rounded border-stone-300"
        />
        Accepter les réservations en ligne (site ubion + Meta)
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={useTableCapacity}
          onChange={(e) => setUseTableCapacity(e.target.checked)}
          className="rounded border-stone-300"
        />
        Calculer la capacité depuis le plan de salle (tables actives)
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enforceOnline}
          onChange={(e) => setEnforceOnline(e.target.checked)}
          className="rounded border-stone-300"
        />
        Bloquer les réservations en ligne si le créneau est complet
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className={uiLabel}>Durée d&apos;une réservation (min)</span>
          <input
            type="number"
            min={30}
            max={360}
            step={15}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className={uiLabel}>Pas entre créneaux</span>
          <select
            value={slotStep}
            onChange={(e) => setSlotStep(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className={uiLabel}>Délai minimum avant résa (min)</span>
          <input
            type="number"
            min={0}
            max={1440}
            value={minLead}
            onChange={(e) => setMinLead(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className={uiLabel}>Max convives / résa en ligne</span>
          <input
            type="number"
            min={1}
            max={50}
            value={maxPartyOnline}
            onChange={(e) => setMaxPartyOnline(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className={uiLabel}>Plafond couverts / créneau (vide = auto)</span>
          <input
            type="number"
            min={1}
            max={500}
            placeholder={String(limits.seating.computedMaxCovers)}
            value={maxCovers}
            onChange={(e) => setMaxCovers(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className={uiLabel}>Plafond en ligne / créneau (vide = part %)</span>
          <input
            type="number"
            min={0}
            max={500}
            placeholder={String(limits.maxOnlineCoversPerSlot)}
            value={maxOnlineCovers}
            onChange={(e) => setMaxOnlineCovers(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className={uiLabel}>Part de capacité réservable en ligne (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={onlineShare}
            onChange={(e) => setOnlineShare(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
          <span className="text-xs text-stone-400">
            Appliqué si le plafond en ligne n&apos;est pas renseigné. Toutes plateformes en ligne confondues.
          </span>
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className={uiLabel}>E-mail de notification (vide = propriétaire)</span>
          <input
            type="email"
            value={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.value)}
            placeholder="reservations@votre-restaurant.fr"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-600">Enregistré.</p> : null}
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="rounded-xl bg-copper-700 px-5 py-2 text-sm font-semibold text-white hover:bg-copper-600 disabled:opacity-50"
      >
        {isPending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}
