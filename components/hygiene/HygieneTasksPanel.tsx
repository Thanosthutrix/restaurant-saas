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
import { completeHygieneTaskAction } from "@/app/hygiene/actions";
import { HygieneProtocolPanel } from "@/components/hygiene/HygieneProtocolPanel";
import { HygieneTaskTileGrid } from "@/components/hygiene/HygieneTaskTileGrid";
import { Modal } from "@/components/ui/Modal";
import { uiBtnPrimary, uiBtnSecondary, uiInput, uiLabel, uiSelect } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  due: HygieneTaskWithElement[];
  upcoming?: HygieneTaskWithElement[];
  /** Mode aperçu sur le hub hygiène (tuiles limitées + lien « Tout voir »). */
  preview?: boolean;
  totalDueCount?: number;
};

function DueEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-6 py-10 text-center">
      <p className="text-base font-semibold text-stone-800">Rien en retard pour l’instant</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
        Les tâches dont l’échéance est passée apparaîtront ici sous forme de tuiles.
      </p>
    </div>
  );
}

export function HygieneTasksPanel({
  restaurantId,
  due,
  upcoming = [],
  preview = false,
  totalDueCount,
}: Props) {
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

  const dueTotal = totalDueCount ?? due.length;

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
    setInitials("");
    setCleaningType("cleaning");
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

  const validationModal = modalTask ? (
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
  ) : null;

  if (preview) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-stone-900">À traiter maintenant</h2>
          <Link
            href="/hygiene/a-faire"
            className="inline-flex items-center gap-1 text-sm font-semibold text-copper-700 transition hover:text-copper-600"
          >
            Tout voir{dueTotal > due.length ? ` (${dueTotal})` : ""}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <HygieneTaskTileGrid tasks={due} onSelect={openModal} />
        {validationModal}
      </section>
    );
  }

  return (
    <div className="space-y-8">
      {due.length === 0 ? (
        <DueEmptyState />
      ) : (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">Échues ou à faire</h2>
          <HygieneTaskTileGrid tasks={due} onSelect={openModal} />
        </section>
      )}

      {upcoming.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">À venir</h2>
          <HygieneTaskTileGrid tasks={upcoming} />
        </section>
      ) : null}

      {validationModal}
    </div>
  );
}
