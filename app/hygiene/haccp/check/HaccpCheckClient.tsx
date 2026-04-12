"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TemperatureTaskWithPoint } from "@/lib/haccpTemperature/types";
import { TEMPERATURE_POINT_TYPE_LABEL_FR } from "@/lib/haccpTemperature/types";
import {
  classifyTemperatureStatus,
  HACCP_TEMPERATURE_ALERT_MARGIN_C,
  requiresCorrectiveFields,
} from "@/lib/haccpTemperature/rules";
import { submitTemperatureLogAction } from "../actions";
import { uiBtnPrimarySm, uiBtnSecondary, uiCard, uiInput, uiLabel } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  tasks: TemperatureTaskWithPoint[];
};

function isOverdue(dueAt: string): boolean {
  return new Date(dueAt) < new Date();
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

  return (
    <div className="space-y-4">
      {tasks.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune tâche en attente. Les relevés apparaissent selon vos points actifs.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const overdue = isOverdue(t.due_at);
            return (
              <li key={t.id} className={uiCard}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{t.point_name}</p>
                    <p className="text-xs text-slate-500">
                      {TEMPERATURE_POINT_TYPE_LABEL_FR[t.point_type]} · {t.location || "—"} · seuils {t.min_threshold}–
                      {t.max_threshold} °C
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Échéance :{" "}
                      {new Date(t.due_at).toLocaleString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {overdue && (
                      <span className="mt-1 inline-block rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-900">
                        En retard
                      </span>
                    )}
                  </div>
                  <button type="button" className={uiBtnPrimarySm} onClick={() => openModal(t)}>
                    Saisir
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modalTask && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className={`${uiCard} max-h-[90vh] w-full max-w-md overflow-y-auto shadow-xl`}>
            <h3 className="text-sm font-semibold text-slate-900">Relevé — {modalTask.point_name}</h3>
            <p className="mt-1 text-xs text-slate-500">
              Marge d’alerte : ±{HACCP_TEMPERATURE_ALERT_MARGIN_C} °C des seuils.
            </p>
            {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
            <div className="mt-3">
              <label className={uiLabel} htmlFor="haccp-temp">
                Température (°C)
              </label>
              <input
                id="haccp-temp"
                type="text"
                inputMode="decimal"
                autoFocus
                className={`${uiInput} mt-1 w-full tabular-nums`}
                value={tempRaw}
                onChange={(e) => setTempRaw(e.target.value)}
              />
            </div>
            {previewStatus && (
              <p className="mt-2 text-sm">
                Indicatif :{" "}
                <span
                  className={
                    previewStatus === "critical"
                      ? "font-semibold text-rose-700"
                      : previewStatus === "alert"
                        ? "font-semibold text-amber-800"
                        : "font-medium text-emerald-800"
                  }
                >
                  {previewStatus === "critical" && "Écart critique"}
                  {previewStatus === "alert" && "Alerte (proche seuil)"}
                  {previewStatus === "normal" && "Normal"}
                </span>
              </p>
            )}
            <div className="mt-3">
              <label className={uiLabel}>Commentaire {needsExtra ? "(obligatoire)" : "(optionnel)"}</label>
              <textarea
                className={`${uiInput} mt-1 min-h-[3rem] w-full`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <div className="mt-3">
              <label className={uiLabel}>
                Action corrective {needsExtra ? "(obligatoire)" : "(optionnel)"}
              </label>
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
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={pending} className={uiBtnPrimarySm} onClick={submit}>
                {pending ? "Envoi…" : "Valider"}
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
