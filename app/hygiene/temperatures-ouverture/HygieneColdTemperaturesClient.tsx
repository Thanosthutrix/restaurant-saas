"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { HygieneElement } from "@/lib/hygiene/types";
import {
  HYGIENE_CATEGORY_LABEL_FR,
  HYGIENE_COLD_EVENT_LABEL_FR,
  type HygieneColdEventKind,
  type HygieneColdTemperatureReadingWithElement,
} from "@/lib/hygiene/types";
import { logColdTemperatureReadingAction } from "../actions";
import { uiBtnPrimarySm, uiBtnSecondary, uiCard, uiInput, uiLabel } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  coldElements: HygieneElement[];
  recentReadings: HygieneColdTemperatureReadingWithElement[];
};

export function HygieneColdTemperaturesClient({ restaurantId, coldElements, recentReadings }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [modal, setModal] = useState<{
    element: HygieneElement;
    eventKind: HygieneColdEventKind;
  } | null>(null);
  const [tempRaw, setTempRaw] = useState("");
  const [initials, setInitials] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openModal(element: HygieneElement, eventKind: HygieneColdEventKind) {
    setModal({ element, eventKind });
    setTempRaw("");
    setInitials("");
    setComment("");
    setError(null);
  }

  function closeModal() {
    setModal(null);
    setError(null);
  }

  function submit() {
    if (!modal) return;
    setError(null);
    start(async () => {
      const r = await logColdTemperatureReadingAction(restaurantId, modal.element.id, {
        eventKind: modal.eventKind,
        temperatureCelsiusRaw: tempRaw,
        initials,
        comment: comment.trim() || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      closeModal();
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {coldElements.length === 0 ? (
        <div className={`${uiCard} text-sm text-slate-600`}>
          <p>
            Aucun équipement froid actif (chambre froide, frigo, congélateur). Ajoutez-en dans{" "}
            <Link href="/hygiene/elements" className="font-medium text-indigo-700 underline">
              Éléments à nettoyer
            </Link>{" "}
            en choisissant la catégorie correspondante.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {coldElements.map((el) => (
            <li key={el.id} className={`${uiCard} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
              <div>
                <p className="font-medium text-slate-900">{el.name}</p>
                <p className="text-xs text-slate-500">
                  {HYGIENE_CATEGORY_LABEL_FR[el.category as keyof typeof HYGIENE_CATEGORY_LABEL_FR] ?? el.category}
                  {el.area_label ? ` · ${el.area_label}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={uiBtnSecondary} onClick={() => openModal(el, "opening")}>
                  Relevé ouverture
                </button>
                <button type="button" className={uiBtnPrimarySm} onClick={() => openModal(el, "closing")}>
                  Relevé fermeture
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {recentReadings.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Derniers relevés</h2>
            <Link
              href="/hygiene/registre-temperatures"
              className="text-sm font-medium text-indigo-700 underline"
            >
              Voir le registre complet
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            {recentReadings.map((r) => (
              <li key={r.id} className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-slate-700">
                <span className="font-medium text-slate-900">{r.element_name}</span>
                <span className="text-slate-500">
                  {" "}
                  · {HYGIENE_COLD_EVENT_LABEL_FR[r.event_kind]} ·{" "}
                  <span className="tabular-nums">{r.temperature_celsius} °C</span>
                </span>
                <span className="ml-2 text-xs text-slate-500">
                  {new Date(r.recorded_at).toLocaleString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className={`${uiCard} w-full max-w-md shadow-xl`}>
            <h3 className="text-sm font-semibold text-slate-900">
              {HYGIENE_COLD_EVENT_LABEL_FR[modal.eventKind]} — {modal.element.name}
            </h3>
            {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
            <div className="mt-3">
              <label className={uiLabel} htmlFor="cold-temp-celsius">
                Température (°C)
              </label>
              <input
                id="cold-temp-celsius"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className={`${uiInput} mt-1 w-full tabular-nums`}
                value={tempRaw}
                onChange={(e) => setTempRaw(e.target.value)}
                placeholder="ex. 3,5 ou -18"
              />
              <p className="mt-1 text-xs text-slate-500">Plage acceptée : -40 °C à +25 °C.</p>
            </div>
            <div className="mt-3">
              <label className={uiLabel} htmlFor="cold-temp-initials">
                Initiales (optionnel)
              </label>
              <input
                id="cold-temp-initials"
                type="text"
                autoComplete="off"
                maxLength={16}
                className={`${uiInput} mt-1 w-full`}
                value={initials}
                onChange={(e) => setInitials(e.target.value)}
                placeholder="Personne ayant effectué le relevé"
              />
            </div>
            <div className="mt-3">
              <label className={uiLabel}>Commentaire (optionnel)</label>
              <textarea
                className={`${uiInput} mt-1 min-h-[3rem] w-full`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Anomalie constatée, etc."
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={pending} className={uiBtnPrimarySm} onClick={submit}>
                {pending ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button type="button" disabled={pending} className={uiBtnSecondary} onClick={closeModal}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
