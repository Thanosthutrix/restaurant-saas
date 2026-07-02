"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, ThermometerSun } from "lucide-react";
import type { TemperatureTaskWithPoint } from "@/lib/haccpTemperature/types";
import { TEMPERATURE_POINT_TYPE_LABEL_FR } from "@/lib/haccpTemperature/types";
import {
  classifyTemperatureStatus,
  HACCP_TEMPERATURE_ALERT_MARGIN_C,
  requiresCorrectiveFields,
} from "@/lib/haccpTemperature/rules";
import { submitTemperatureLogAction } from "../actions";
import { Modal } from "@/components/ui/Modal";
import { fmtWhen } from "../../hygieneUi";
import { pointTypeMeta, statusMeta } from "../haccpUi";
import { uiBtnPrimary, uiBtnSecondary, uiInput, uiLabel } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  tasks: TemperatureTaskWithPoint[];
};

function currentMs(): number {
  return Date.now();
}

export function HaccpCheckClient({ restaurantId, tasks }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [modalTask, setModalTask] = useState<TemperatureTaskWithPoint | null>(null);
  const [tempRaw, setTempRaw] = useState("");
  const [comment, setComment] = useState("");
  const [corrective, setCorrective] = useState("");
  const [productImpact, setProductImpact] = useState("");
  const [error, setError] = useState<string | null>(null);

  const nowMs = currentMs();
  const overdueCount = tasks.filter((t) => new Date(t.due_at).getTime() < nowMs).length;

  const previewStatus = useMemo(() => {
    if (!modalTask) return null;
    const s = tempRaw.trim().replace(",", ".").replace(/\s+/g, "");
    if (s === "") return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return classifyTemperatureStatus(n, modalTask.min_threshold, modalTask.max_threshold);
  }, [modalTask, tempRaw]);

  const needsExtra = previewStatus != null && requiresCorrectiveFields(previewStatus);

  function openModal(t: TemperatureTaskWithPoint) {
    setModalTask(t);
    setTempRaw("");
    setComment("");
    setCorrective("");
    setProductImpact("");
    setError(null);
  }

  function closeModal() {
    setModalTask(null);
    setError(null);
  }

  function submit() {
    if (!modalTask) return;
    setError(null);
    start(async () => {
      const r = await submitTemperatureLogAction(restaurantId, modalTask.id, {
        temperatureRaw: tempRaw,
        comment: comment.trim() || null,
        correctiveAction: corrective.trim() || null,
        productImpact: productImpact.trim() || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      closeModal();
      router.refresh();
    });
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-12 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden />
        <p className="text-base font-semibold text-emerald-900">Aucun relevé en attente</p>
        <p className="max-w-md text-sm text-emerald-700">
          Les relevés apparaissent ici selon vos points actifs et leur fréquence. Revenez au prochain créneau.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {overdueCount > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
          <CalendarClock className="h-5 w-5 shrink-0 text-rose-600" aria-hidden />
          <span>
            <span className="font-semibold">{overdueCount}</span> relevé{overdueCount > 1 ? "s" : ""} en retard sur{" "}
            {tasks.length} en attente.
          </span>
        </div>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tasks.map((t) => {
          const meta = pointTypeMeta(t.point_type);
          const Icon = meta.Icon;
          const when = fmtWhen(t.due_at, nowMs);
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => openModal(t)}
                className={`group relative flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border bg-white p-3 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md ${meta.tile} ${
                  when.overdue ? "border-rose-300 ring-1 ring-rose-200" : "border-stone-200/60"
                }`}
              >
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${meta.tone}`}>
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <span className="line-clamp-2 text-[13px] font-semibold leading-tight tracking-tight text-stone-900">
                  {t.point_name}
                </span>
                <span className="text-[11px] tabular-nums text-stone-400">
                  {t.min_threshold}–{t.max_threshold} °C
                </span>
                <span className={`text-[11px] font-medium ${when.overdue ? "text-rose-600" : "text-stone-400"}`}>
                  {when.hint}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {modalTask ? (
        <Modal
          title={`Relevé — ${modalTask.point_name}`}
          subtitle={`${TEMPERATURE_POINT_TYPE_LABEL_FR[modalTask.point_type]}${modalTask.location ? ` · ${modalTask.location}` : ""} · seuils ${modalTask.min_threshold}–${modalTask.max_threshold} °C`}
          icon={pointTypeMeta(modalTask.point_type).Icon}
          tone={pointTypeMeta(modalTask.point_type).tone}
          onClose={closeModal}
          footer={
            <>
              <button type="button" disabled={pending} className={uiBtnPrimary} onClick={submit}>
                {pending ? "Envoi…" : "Valider le relevé"}
              </button>
              <button type="button" disabled={pending} className={uiBtnSecondary} onClick={closeModal}>
                Annuler
              </button>
              {error ? <span className="text-sm text-rose-700">{error}</span> : null}
            </>
          }
        >
          <div>
            <label className={uiLabel} htmlFor="haccp-temp">
              Température relevée (°C)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
                <ThermometerSun className="h-5 w-5" aria-hidden />
              </span>
              <input
                id="haccp-temp"
                type="text"
                inputMode="decimal"
                autoFocus
                className={`${uiInput} h-11 flex-1 text-lg tabular-nums`}
                value={tempRaw}
                onChange={(e) => setTempRaw(e.target.value)}
                placeholder="ex. 3,5"
              />
            </div>
            <p className="mt-1 text-xs text-stone-500">
              Marge d’alerte : ±{HACCP_TEMPERATURE_ALERT_MARGIN_C} °C des seuils.
            </p>
          </div>

          {previewStatus ? (
            <div className="mt-3">
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${statusMeta(previewStatus).chip}`}>
                {statusMeta(previewStatus).label}
              </span>
            </div>
          ) : null}

          <div className="mt-3">
            <label className={uiLabel}>Commentaire {needsExtra ? "(obligatoire)" : "(optionnel)"}</label>
            <textarea
              className={`${uiInput} mt-1 min-h-[3rem] w-full`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <div className="mt-3">
            <label className={uiLabel}>Action corrective {needsExtra ? "(obligatoire)" : "(optionnel)"}</label>
            <textarea
              className={`${uiInput} mt-1 min-h-[3rem] w-full`}
              value={corrective}
              onChange={(e) => setCorrective(e.target.value)}
              placeholder="ex. Ajustement thermostat, mise en déchets…"
            />
          </div>
          <div className="mt-3">
            <label className={uiLabel}>Impact produit (optionnel)</label>
            <input
              className={`${uiInput} mt-1 w-full`}
              value={productImpact}
              onChange={(e) => setProductImpact(e.target.value)}
            />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
