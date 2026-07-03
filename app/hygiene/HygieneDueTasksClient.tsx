"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { ArrowRight, Camera, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { HYGIENE_PROOFS_BUCKET } from "@/lib/constants";
import type { HygieneTaskWithElement } from "@/lib/hygiene/hygieneDb";
import {
  HYGIENE_CLEANING_ACTION_TYPES,
  HYGIENE_CLEANING_ACTION_LABEL_FR,
} from "@/lib/hygiene/types";
import { completeHygieneTaskAction } from "./actions";
import { HygieneProtocolPanel } from "@/components/hygiene/HygieneProtocolPanel";
import { Modal } from "@/components/ui/Modal";
import { RiskPill, fmtWhen } from "./hygieneUi";
import { uiBtnPrimary, uiBtnSecondary, uiInput, uiLabel, uiSelect } from "@/components/ui/premium";

function currentMs(): number {
  return Date.now();
}

export function HygieneDueTasksClient({
  restaurantId,
  tasks,
  dueCount,
}: {
  restaurantId: string;
  tasks: HygieneTaskWithElement[];
  dueCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [modalTask, setModalTask] = useState<HygieneTaskWithElement | null>(null);
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cleaningType, setCleaningType] = useState<(typeof HYGIENE_CLEANING_ACTION_TYPES)[number]>("cleaning");
  const [initials, setInitials] = useState("");
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const nowMs = currentMs();

  function openModal(t: HygieneTaskWithElement) {
    setModalTask(t);
    setComment("");
    setFile(null);
    setCleaningType("cleaning");
    setInitials("");
    setError(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function closeModal() {
    setModalTask(null);
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
    const task = modalTask;
    start(async () => {
      let proofPath: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${restaurantId}/tasks/${task.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(HYGIENE_PROOFS_BUCKET)
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) {
          setError(upErr.message);
          return;
        }
        proofPath = path;
      }
      const r = await completeHygieneTaskAction(restaurantId, task.id, {
        comment: comment.trim() || null,
        proofPhotoPath: proofPath,
        cleaningActionType: cleaningType,
        initials,
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
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-stone-900">À traiter maintenant</h2>
        <Link
          href="/hygiene/a-faire"
          className="inline-flex items-center gap-1 text-sm font-semibold text-copper-700 transition hover:text-copper-600"
        >
          Tout voir{dueCount > tasks.length ? ` (${dueCount})` : ""}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <ul className="space-y-2">
        {tasks.map((t) => {
          const when = fmtWhen(t.due_at, nowMs);
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => openModal(t)}
                className="group flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-rose-200/70 bg-white px-4 py-3 text-left shadow-sm transition hover:border-rose-300 hover:shadow-md"
              >
                <RiskPill level={t.risk_level} />
                <span className="min-w-0 flex-1">
                  <span className="truncate font-medium text-stone-900">{t.element_name}</span>
                  {t.area_label ? <span className="ml-1.5 text-xs text-stone-400">· {t.area_label}</span> : null}
                </span>
                <span className="text-xs font-medium text-rose-600">{when.hint}</span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 transition group-hover:bg-emerald-100">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Valider
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {modalTask ? (
        <Modal
          title="Valider la tâche"
          subtitle={modalTask.element_name}
          icon={CheckCircle2}
          tone="bg-emerald-50 text-emerald-700"
          onClose={closeModal}
          footer={
            <>
              <button type="button" disabled={pending} className={uiBtnPrimary} onClick={submitComplete}>
                {pending ? "Envoi…" : "Confirmer"}
              </button>
              <button type="button" disabled={pending} className={uiBtnSecondary} onClick={closeModal}>
                Annuler
              </button>
              {error ? <span className="text-sm text-rose-700">{error}</span> : null}
            </>
          }
        >
          <HygieneProtocolPanel
            description={modalTask.element_description}
            cleaningProtocol={modalTask.cleaning_protocol}
            disinfectionProtocol={modalTask.disinfection_protocol}
            productUsed={modalTask.product_used}
            dosage={modalTask.dosage}
            contactTime={modalTask.contact_time}
          />
          <div className="mt-3">
            <label className={uiLabel} htmlFor="hub-task-action-type">
              Type d’intervention
            </label>
            <select
              id="hub-task-action-type"
              className={`${uiSelect} mt-1 w-full`}
              value={cleaningType}
              onChange={(e) => setCleaningType(e.target.value as (typeof HYGIENE_CLEANING_ACTION_TYPES)[number])}
            >
              {HYGIENE_CLEANING_ACTION_TYPES.map((k) => (
                <option key={k} value={k}>
                  {HYGIENE_CLEANING_ACTION_LABEL_FR[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <label className={uiLabel} htmlFor="hub-task-initials">
              Initiales (personne ayant réalisé l’intervention)
            </label>
            <input
              id="hub-task-initials"
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
              {file ? (
                <span className="text-xs text-stone-600">
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
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
