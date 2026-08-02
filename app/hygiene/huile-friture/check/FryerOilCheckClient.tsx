"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, Droplets } from "lucide-react";
import type { FryerOilTaskWithUnit } from "@/lib/fryerOil/types";
import { TPM_TEST_METHODS, TPM_TEST_METHOD_LABEL_FR } from "@/lib/fryerOil/types";
import {
  classifyFryerOilCheck,
  parseOilTemperatureInput,
  parseTpmInput,
  requiresCorrectiveFields,
} from "@/lib/fryerOil/rules";
import { submitFryerOilCheckAction } from "../actions";
import { Modal } from "@/components/ui/Modal";
import { fmtWhen } from "../../hygieneUi";
import { FRYER_TILE, FryerStatusPill, fryerStatusMeta } from "../fryerOilUi";
import { uiBtnPrimary, uiBtnSecondary, uiInput, uiLabel } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  tasks: FryerOilTaskWithUnit[];
};

export function FryerOilCheckClient({ restaurantId, tasks }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [modalTask, setModalTask] = useState<FryerOilTaskWithUnit | null>(null);
  const [tpmRaw, setTpmRaw] = useState("");
  const [tpmMethod, setTpmMethod] = useState<(typeof TPM_TEST_METHODS)[number]>("strip");
  const [tempRaw, setTempRaw] = useState("");
  const [filtrationDone, setFiltrationDone] = useState(false);
  const [qualityOk, setQualityOk] = useState(true);
  const [qualityIssues, setQualityIssues] = useState("");
  const [oilChanged, setOilChanged] = useState(false);
  const [newOilName, setNewOilName] = useState("");
  const [comment, setComment] = useState("");
  const [corrective, setCorrective] = useState("");
  const [error, setError] = useState<string | null>(null);

  const nowMs = Date.now();
  const overdueCount = tasks.filter((t) => new Date(t.due_at).getTime() < nowMs).length;

  const preview = useMemo(() => {
    if (!modalTask) return null;
    const temp = parseOilTemperatureInput(tempRaw);
    const tpm = tpmRaw.trim() ? parseTpmInput(tpmRaw) : { ok: true as const, value: null };
    if (!temp.ok) return null;
    const tpmVal = tpm.ok ? tpm.value : null;
    return classifyFryerOilCheck({
      unit: {
        id: modalTask.fryer_unit_id,
        restaurant_id: restaurantId,
        name: modalTask.unit_name,
        location: modalTask.location,
        capacity_liters: null,
        oil_temp_min_celsius: modalTask.oil_temp_min_celsius,
        oil_temp_max_celsius: modalTask.oil_temp_max_celsius,
        tpm_alert_threshold_pct: modalTask.tpm_alert_threshold_pct,
        tpm_change_threshold_pct: modalTask.tpm_change_threshold_pct,
        recurrence_type: "daily",
        active: true,
        created_at: "",
        updated_at: "",
      },
      tpmPercent: tpmVal,
      oilTemperatureCelsius: temp.value,
      qualityOk,
      filtrationDone,
    });
  }, [modalTask, tempRaw, tpmRaw, qualityOk, filtrationDone, restaurantId]);

  const needsExtra =
    (preview != null && requiresCorrectiveFields(preview.logStatus)) ||
    oilChanged ||
    (preview?.changeOilRequired ?? false);

  function openModal(t: FryerOilTaskWithUnit) {
    setModalTask(t);
    setTpmRaw("");
    setTpmMethod("strip");
    setTempRaw("");
    setFiltrationDone(false);
    setQualityOk(true);
    setQualityIssues("");
    setOilChanged(false);
    setNewOilName("");
    setComment("");
    setCorrective("");
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
      const r = await submitFryerOilCheckAction(restaurantId, modalTask.id, {
        tpmRaw,
        tpmTestMethod: tpmMethod,
        oilTemperatureRaw: tempRaw,
        filtrationDone,
        qualityOk,
        qualityIssues: qualityIssues.trim() || null,
        oilChanged,
        newOilProductName: newOilName.trim() || null,
        comment: comment.trim() || null,
        correctiveAction: corrective.trim() || null,
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
        <p className="text-base font-semibold text-emerald-900">Aucun contrôle en attente</p>
        <p className="max-w-md text-sm text-emerald-700">
          Les contrôles huile (TPM, température, filtration) apparaissent selon vos friteuses configurées.
        </p>
      </div>
    );
  }

  const Icon = FRYER_TILE.Icon;

  return (
    <div className="space-y-4">
      {overdueCount > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
          <CalendarClock className="h-5 w-5 shrink-0 text-rose-600" aria-hidden />
          <span>
            <span className="font-semibold">{overdueCount}</span> contrôle{overdueCount > 1 ? "s" : ""} en retard.
          </span>
        </div>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tasks.map((t) => {
          const when = fmtWhen(t.due_at, nowMs);
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => openModal(t)}
                className={`group relative flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border bg-white p-3 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md ${FRYER_TILE.tile} ${
                  when.overdue ? "border-rose-300 ring-1 ring-rose-200" : "border-stone-200/60"
                }`}
              >
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${FRYER_TILE.tone}`}>
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-stone-900">
                  {t.unit_name}
                </span>
                <span className="text-[11px] tabular-nums text-stone-400">
                  TPM ≤ {t.tpm_change_threshold_pct} % · {t.oil_temp_min_celsius}–{t.oil_temp_max_celsius} °C
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
          title={`Contrôle huile — ${modalTask.unit_name}`}
          subtitle={`TPM alerte ${modalTask.tpm_alert_threshold_pct} % · changement ${modalTask.tpm_change_threshold_pct} % · huile ${modalTask.oil_temp_min_celsius}–${modalTask.oil_temp_max_celsius} °C`}
          icon={Droplets}
          tone={FRYER_TILE.tone}
          onClose={closeModal}
          size="lg"
          footer={
            <>
              <button type="button" disabled={pending} className={uiBtnPrimary} onClick={submit}>
                Enregistrer
              </button>
              <button type="button" disabled={pending} className={uiBtnSecondary} onClick={closeModal}>
                Annuler
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs leading-relaxed text-amber-950">
              Contrôle conforme arrêté du 21/12/2009 et bonnes pratiques DGCCRF : test TPM (bandelette ou appareil),
              température de friture, filtration quotidienne, qualité visuelle et olfactive (odeur, mousse, fumée).
            </div>

            <div>
              <label className={uiLabel} htmlFor="tpm-method">
                Méthode TPM
              </label>
              <select
                id="tpm-method"
                className={uiInput + " mt-1 w-full"}
                value={tpmMethod}
                onChange={(e) => setTpmMethod(e.target.value as (typeof TPM_TEST_METHODS)[number])}
              >
                {TPM_TEST_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {TPM_TEST_METHOD_LABEL_FR[m]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={uiLabel} htmlFor="tpm-value">
                Taux TPM (% matières polaires)
              </label>
              <input
                id="tpm-value"
                className={uiInput + " mt-1 w-full"}
                inputMode="decimal"
                placeholder="Ex. 18,5"
                value={tpmRaw}
                onChange={(e) => setTpmRaw(e.target.value)}
              />
            </div>

            <div>
              <label className={uiLabel} htmlFor="oil-temp">
                Température huile (°C)
              </label>
              <input
                id="oil-temp"
                className={uiInput + " mt-1 w-full"}
                inputMode="decimal"
                placeholder="Ex. 175"
                value={tempRaw}
                onChange={(e) => setTempRaw(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={filtrationDone}
                onChange={(e) => setFiltrationDone(e.target.checked)}
                className="rounded border-stone-300"
              />
              Filtration de l&apos;huile effectuée aujourd&apos;hui
            </label>

            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={qualityOk}
                onChange={(e) => setQualityOk(e.target.checked)}
                className="rounded border-stone-300"
              />
              Qualité OK (pas d&apos;odeur rance, mousse excessive ni fumée anormale)
            </label>

            {!qualityOk ? (
              <div>
                <label className={uiLabel} htmlFor="quality-issues">
                  Problème constaté
                </label>
                <input
                  id="quality-issues"
                  className={uiInput + " mt-1 w-full"}
                  placeholder="Odeur, mousse, couleur…"
                  value={qualityIssues}
                  onChange={(e) => setQualityIssues(e.target.value)}
                />
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-sm font-medium text-stone-800">
              <input
                type="checkbox"
                checked={oilChanged}
                onChange={(e) => setOilChanged(e.target.checked)}
                className="rounded border-stone-300"
              />
              Changement d&apos;huile effectué maintenant
            </label>

            {oilChanged ? (
              <div>
                <label className={uiLabel} htmlFor="new-oil">
                  Type d&apos;huile (optionnel)
                </label>
                <input
                  id="new-oil"
                  className={uiInput + " mt-1 w-full"}
                  placeholder="Ex. tournesol haute oleïque"
                  value={newOilName}
                  onChange={(e) => setNewOilName(e.target.value)}
                />
              </div>
            ) : null}

            {preview ? (
              <div className={`rounded-xl border px-3 py-2 ${fryerStatusMeta(preview.logStatus).ring} bg-white`}>
                <div className="flex items-center gap-2">
                  <FryerStatusPill status={preview.logStatus} />
                  {preview.changeOilRequired ? (
                    <span className="text-xs font-medium text-rose-700">Changement d&apos;huile recommandé</span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {needsExtra ? (
              <>
                <div>
                  <label className={uiLabel} htmlFor="fryer-comment">
                    Commentaire *
                  </label>
                  <textarea
                    id="fryer-comment"
                    className={uiInput + " mt-1 min-h-[4rem] w-full"}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>
                <div>
                  <label className={uiLabel} htmlFor="fryer-corrective">
                    Action corrective *
                  </label>
                  <textarea
                    id="fryer-corrective"
                    className={uiInput + " mt-1 min-h-[4rem] w-full"}
                    placeholder="Ex. huile changée, cuve nettoyée, filtration renforcée…"
                    value={corrective}
                    onChange={(e) => setCorrective(e.target.value)}
                  />
                </div>
              </>
            ) : null}

            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
