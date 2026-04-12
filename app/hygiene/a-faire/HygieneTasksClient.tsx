"use client";

import { useRef, useState, useTransition } from "react";
import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { HYGIENE_PROOFS_BUCKET } from "@/lib/constants";
import type { HygieneTaskWithElement } from "@/lib/hygiene/hygieneDb";
import {
  HYGIENE_CATEGORY_LABEL_FR,
  HYGIENE_CLEANING_ACTION_TYPES,
  HYGIENE_CLEANING_ACTION_LABEL_FR,
  HYGIENE_RISK_LABEL_FR,
} from "@/lib/hygiene/types";
import { completeHygieneTaskAction } from "../actions";
import {
  uiBtnPrimarySm,
  uiBtnSecondary,
  uiCard,
  uiInput,
  uiLabel,
  uiSelect,
} from "@/components/ui/premium";

function riskBadgeClass(r: string): string {
  if (r === "critical") return "bg-rose-100 text-rose-900 ring-1 ring-rose-200";
  if (r === "important") return "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
  return "bg-slate-100 text-slate-800 ring-1 ring-slate-200";
}

export function HygieneTasksClient({
  restaurantId,
  due,
  upcoming,
}: {
  restaurantId: string;
  due: HygieneTaskWithElement[];
  upcoming: HygieneTaskWithElement[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [modalTask, setModalTask] = useState<HygieneTaskWithElement | null>(null);
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cleaningType, setCleaningType] =
    useState<(typeof HYGIENE_CLEANING_ACTION_TYPES)[number]>("cleaning");
  const [initials, setInitials] = useState("");
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  function openModal(t: HygieneTaskWithElement) {
    setModalTask(t);
    setComment("");
    setFile(null);
    setCleaningType("cleaning");
    setInitials("");
    setError(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function submitComplete() {
    if (!modalTask) return;
    const critical = modalTask.risk_level === "critical";
    if (initials.trim().length < 2) {
      setError("Indiquez au moins 2 caractères pour les initiales.");
      return;
    }
    if (critical && !file) {
      setError("Photo obligatoire pour une tâche critique.");
      return;
    }
    setError(null);
    start(async () => {
      let proofPath: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${restaurantId}/tasks/${modalTask.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(HYGIENE_PROOFS_BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (upErr) {
          setError(upErr.message);
          return;
        }
        proofPath = path;
      }
      const r = await completeHygieneTaskAction(restaurantId, modalTask.id, {
        comment: comment.trim() || null,
        proofPhotoPath: proofPath,
        cleaningActionType: cleaningType,
        initials,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setModalTask(null);
      setInitials("");
      setCleaningType("cleaning");
      if (photoInputRef.current) photoInputRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Échues ou à faire</h2>
        {due.length === 0 ? (
          <p className="text-sm text-slate-500">Rien en retard pour l’instant.</p>
        ) : (
          <ul className="space-y-2">
            {due.map((t) => (
              <li key={t.id} className={uiCard}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{t.element_name}</p>
                    <p className="text-xs text-slate-500">
                      {HYGIENE_CATEGORY_LABEL_FR[t.element_category as keyof typeof HYGIENE_CATEGORY_LABEL_FR] ??
                        t.element_category}{" "}
                      · {t.area_label || "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Échéance :{" "}
                      {new Date(t.due_at).toLocaleString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskBadgeClass(t.risk_level)}`}>
                      {HYGIENE_RISK_LABEL_FR[t.risk_level]}
                    </span>
                    {t.risk_level === "critical" && (
                      <span className="text-xs font-medium text-rose-700">Photo requise</span>
                    )}
                    <button type="button" className={uiBtnPrimarySm} onClick={() => openModal(t)}>
                      Valider
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">À venir</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune tâche planifiée à venir dans la fenêtre chargée.</p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((t) => (
              <li key={t.id} className={`${uiCard} text-sm text-slate-600`}>
                <span className="font-medium text-slate-800">{t.element_name}</span> ·{" "}
                {new Date(t.due_at).toLocaleString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${riskBadgeClass(t.risk_level)}`}>
                  {HYGIENE_RISK_LABEL_FR[t.risk_level]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modalTask && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className={`${uiCard} max-h-[90vh] w-full max-w-md overflow-y-auto shadow-xl`}>
            <h3 className="text-sm font-semibold text-slate-900">Valider la tâche</h3>
            <p className="mt-1 text-sm text-slate-600">{modalTask.element_name}</p>
            {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
            <div className="mt-3">
              <label className={uiLabel} htmlFor="hygiene-task-action-type">
                Type d’intervention
              </label>
              <select
                id="hygiene-task-action-type"
                className={`${uiSelect} mt-1 w-full`}
                value={cleaningType}
                onChange={(e) =>
                  setCleaningType(e.target.value as (typeof HYGIENE_CLEANING_ACTION_TYPES)[number])
                }
              >
                {HYGIENE_CLEANING_ACTION_TYPES.map((k) => (
                  <option key={k} value={k}>
                    {HYGIENE_CLEANING_ACTION_LABEL_FR[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3">
              <label className={uiLabel} htmlFor="hygiene-task-initials">
                Initiales (personne ayant réalisé l’intervention)
              </label>
              <input
                id="hygiene-task-initials"
                type="text"
                autoComplete="off"
                maxLength={16}
                className={`${uiInput} mt-1 w-full`}
                value={initials}
                onChange={(e) => setInitials(e.target.value)}
                placeholder="ex. J.D."
              />
            </div>
            <div className="mt-3">
              <label className={uiLabel}>Commentaire (optionnel)</label>
              <textarea
                className={`${uiInput} mt-1 min-h-[4rem] w-full`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <div className="mt-3">
              <label className={uiLabel}>
                {modalTask.risk_level === "critical" ? "Photo de preuve (obligatoire)" : "Photo (optionnel)"}
              </label>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                aria-hidden
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={`${uiBtnSecondary} inline-flex items-center gap-2`}
                  onClick={() => photoInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4 shrink-0" aria-hidden />
                  Prendre une photo
                </button>
                {file && (
                  <span className="text-xs text-slate-600">
                    {file.name}
                    <button
                      type="button"
                      className="ml-2 text-rose-700 underline"
                      onClick={() => {
                        setFile(null);
                        if (photoInputRef.current) photoInputRef.current.value = "";
                      }}
                    >
                      Retirer
                    </button>
                  </span>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={pending} className={uiBtnPrimarySm} onClick={submitComplete}>
                {pending ? "Envoi…" : "Confirmer"}
              </button>
              <button
                type="button"
                disabled={pending}
                className={uiBtnSecondary}
                onClick={() => {
                  setModalTask(null);
                  setInitials("");
                  setCleaningType("cleaning");
                  if (photoInputRef.current) photoInputRef.current.value = "";
                }}
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
