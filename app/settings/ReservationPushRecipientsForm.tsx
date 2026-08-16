"use client";

import { useState, useTransition } from "react";
import { updateReservationPushRecipientsAction } from "@/app/settings/actions";
import { uiLabel } from "@/components/ui/premium";
import type { ReservationPushRecipientOption } from "@/lib/reservations/reservationPushRecipients";

type Props = {
  options: ReservationPushRecipientOption[];
  initialSelectedUserIds: string[];
};

export function ReservationPushRecipientsForm({ options, initialSelectedUserIds }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedUserIds));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateReservationPushRecipientsAction([...selected]);
      if (!res.ok) setError(res.error);
      else setSaved(true);
    });
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        Aucun compte équipe avec accès Ubion. Seul le propriétaire peut recevoir les alertes.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">
        Choisissez qui reçoit une notification push sur l&apos;app mobile lors d&apos;une réservation
        (site, Instagram, Messenger). Seuls les appareils <strong>connectés</strong> au compte
        sélectionné et ouverts sur <strong>cet établissement</strong> sont notifiés.
      </p>
      <ul className="space-y-2">
        {options.map((opt) => (
          <li key={opt.userId}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 px-3 py-2.5 text-sm hover:bg-stone-50">
              <input
                type="checkbox"
                checked={selected.has(opt.userId)}
                onChange={() => toggle(opt.userId)}
                className="rounded border-stone-300"
              />
              <span>
                <span className="font-medium text-stone-900">{opt.label}</span>
                {opt.kind === "owner" ? (
                  <span className="ml-2 text-xs text-stone-500">propriétaire</span>
                ) : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {selected.size === 0 ? (
        <p className="text-xs text-amber-700">
          Aucun destinataire push — seuls les e-mails seront envoyés.
        </p>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-600">Enregistré.</p> : null}
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="rounded-xl bg-copper-700 px-5 py-2 text-sm font-semibold text-white hover:bg-copper-600 disabled:opacity-50"
      >
        {isPending ? "Enregistrement…" : "Enregistrer les destinataires"}
      </button>
    </div>
  );
}
