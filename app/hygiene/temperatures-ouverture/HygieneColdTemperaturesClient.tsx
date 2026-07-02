"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, Refrigerator, Snowflake, Sunrise, Sunset, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { HygieneElement } from "@/lib/hygiene/types";
import {
  HYGIENE_CATEGORY_LABEL_FR,
  HYGIENE_COLD_EVENT_LABEL_FR,
  type HygieneColdEventKind,
  type HygieneColdTemperatureReadingWithElement,
} from "@/lib/hygiene/types";
import { logColdTemperatureReadingAction } from "../actions";
import { Modal } from "@/components/ui/Modal";
import { uiBtnPrimary, uiBtnSecondary, uiInput, uiLabel } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  coldElements: HygieneElement[];
  recentReadings: HygieneColdTemperatureReadingWithElement[];
};

function coldMeta(category: string): { Icon: LucideIcon; tone: string; tile: string } {
  if (category === "congelateur") return { Icon: Snowflake, tone: "bg-cyan-50 text-cyan-700", tile: "tile-cyan" };
  return { Icon: Refrigerator, tone: "bg-sky-50 text-sky-700", tile: "tile-sky" };
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short" })} · ${d.toLocaleTimeString(
    "fr-FR",
    { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }
  )}`;
}

export function HygieneColdTemperaturesClient({ restaurantId, coldElements, recentReadings }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [modalEl, setModalEl] = useState<HygieneElement | null>(null);
  const [eventKind, setEventKind] = useState<HygieneColdEventKind>("opening");
  const [tempRaw, setTempRaw] = useState("");
  const [initials, setInitials] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openModal(element: HygieneElement) {
    setModalEl(element);
    setEventKind("opening");
    setTempRaw("");
    setInitials("");
    setComment("");
    setError(null);
  }

  function closeModal() {
    setModalEl(null);
    setError(null);
  }

  function submit() {
    if (!modalEl) return;
    setError(null);
    start(async () => {
      const r = await logColdTemperatureReadingAction(restaurantId, modalEl.id, {
        eventKind,
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
    <div className="space-y-6">
      {coldElements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-6 py-10 text-center">
          <p className="text-base font-semibold text-stone-800">Aucun équipement froid actif</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
            Ajoutez une chambre froide, un frigo ou un congélateur dans{" "}
            <Link href="/hygiene/elements" className="font-medium text-copper-800 underline">
              Éléments à nettoyer
            </Link>{" "}
            en choisissant la catégorie correspondante.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {coldElements.map((el) => {
            const meta = coldMeta(el.category);
            const Icon = meta.Icon;
            return (
              <li key={el.id}>
                <button
                  type="button"
                  onClick={() => openModal(el)}
                  className={`group flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border border-stone-200/60 bg-white p-3 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md ${meta.tile}`}
                >
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${meta.tone}`}>
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="line-clamp-2 text-[13px] font-semibold leading-tight tracking-tight text-stone-900">
                    {el.name}
                  </span>
                  <span className="line-clamp-1 text-[11px] text-stone-400">
                    {el.area_label ||
                      HYGIENE_CATEGORY_LABEL_FR[el.category as keyof typeof HYGIENE_CATEGORY_LABEL_FR]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {recentReadings.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-stone-900">Derniers relevés</h2>
            <Link
              href="/hygiene/registre-temperatures"
              className="inline-flex items-center gap-1 text-sm font-semibold text-copper-700 transition hover:text-copper-600"
            >
              Registre complet
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <ul className="space-y-2">
            {recentReadings.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-stone-200/70 bg-white px-4 py-3 shadow-sm"
              >
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    r.event_kind === "opening" ? "bg-amber-100 text-amber-900" : "bg-indigo-100 text-indigo-800"
                  }`}
                >
                  {r.event_kind === "opening" ? (
                    <Sunrise className="h-3 w-3" aria-hidden />
                  ) : (
                    <Sunset className="h-3 w-3" aria-hidden />
                  )}
                  {HYGIENE_COLD_EVENT_LABEL_FR[r.event_kind]}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-stone-900">{r.element_name}</span>
                <span className="font-semibold tabular-nums text-stone-800">{r.temperature_celsius} °C</span>
                <span className="text-xs text-stone-400">{fmtDateTime(r.recorded_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {modalEl ? (
        <Modal
          title={modalEl.name}
          subtitle={HYGIENE_CATEGORY_LABEL_FR[modalEl.category as keyof typeof HYGIENE_CATEGORY_LABEL_FR] ?? modalEl.category}
          icon={coldMeta(modalEl.category).Icon}
          tone={coldMeta(modalEl.category).tone}
          onClose={closeModal}
          footer={
            <>
              <button type="button" disabled={pending} className={uiBtnPrimary} onClick={submit}>
                {pending ? "Enregistrement…" : "Enregistrer le relevé"}
              </button>
              <button type="button" disabled={pending} className={uiBtnSecondary} onClick={closeModal}>
                Annuler
              </button>
              {error ? <span className="text-sm text-rose-700">{error}</span> : null}
            </>
          }
        >
          {/* Choix du moment */}
          <div>
            <span className={uiLabel}>Moment du relevé</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["opening", "closing"] as const).map((k) => {
                const active = eventKind === k;
                const Icon = k === "opening" ? Sunrise : Sunset;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setEventKind(k)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? "border-copper-300 bg-copper-50 text-copper-800"
                        : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {HYGIENE_COLD_EVENT_LABEL_FR[k]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3">
            <label className={uiLabel} htmlFor="cold-temp-celsius">
              Température (°C)
            </label>
            <input
              id="cold-temp-celsius"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              className={`${uiInput} mt-1 w-full text-lg tabular-nums`}
              value={tempRaw}
              onChange={(e) => setTempRaw(e.target.value)}
              placeholder="ex. 3,5 ou -18"
            />
            <p className="mt-1 text-xs text-stone-500">Plage acceptée : -40 °C à +25 °C.</p>
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
        </Modal>
      ) : null}
    </div>
  );
}
