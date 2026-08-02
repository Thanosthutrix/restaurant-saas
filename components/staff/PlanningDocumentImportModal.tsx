"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { MENU_IMPORT_STORAGE_BUCKET } from "@/lib/constants";
import { importPlanningFromDocumentAction } from "@/app/equipe/actions";
import { ModalOverlay } from "@/components/ui/ModalOverlay";
import { uiBtnOutlineSm, uiBtnPrimarySm, uiError, uiLabel } from "@/components/ui/premium";

export type PlanningImportResult = {
  generatedCount: number;
  simulationId: string;
  weeksCount: number;
  weekMondays: string[];
  focusWeekMonday: string;
  summaryFr: string | null;
  unmatchedNames: string[];
  notes: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  weekMondayIso: string;
  disabled?: boolean;
  onImported: (result: PlanningImportResult) => void;
};

export function PlanningDocumentImportModal({
  open,
  onClose,
  restaurantId,
  weekMondayIso,
  disabled,
  onImported,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetFile() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClose() {
    if (loading) return;
    setError(null);
    resetFile();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choisissez une photo ou un PDF de votre planning.");
      return;
    }

    setError(null);
    setLoading(true);

    const ext =
      file.name.toLowerCase().endsWith(".pdf") ? "pdf"
      : file.type.includes("png") ? "png"
      : file.type.includes("webp") ? "webp"
      : "jpg";
    const path = `${restaurantId}/planning-imports/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from(MENU_IMPORT_STORAGE_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadErr) {
      setLoading(false);
      setError(`Échec de l'upload : ${uploadErr.message}`);
      return;
    }

    const result = await importPlanningFromDocumentAction({
      restaurantId,
      weekMondayYmd: weekMondayIso,
      storagePath: path,
      fileName: file.name,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    resetFile();
    onImported({
      generatedCount: result.generatedCount,
      simulationId: result.simulationId,
      weeksCount: result.weeksCount,
      weekMondays: result.weekMondays,
      focusWeekMonday: result.focusWeekMonday,
      summaryFr: result.summaryFr,
      unmatchedNames: result.unmatchedNames,
      notes: result.notes,
    });
    onClose();
  }

  if (!open) return null;

  return (
    <ModalOverlay onClose={handleClose}>
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-stone-900">Importer un planning</h2>
        <p className="mt-1 text-sm text-stone-600">
          Photographiez ou importez votre planning existant (Excel exporté, papier, screenshot, planning mensuel…).
          L&apos;IA extrait <strong className="font-medium">tous les créneaux visibles</strong> et les répartit dans les{" "}
          <strong className="font-medium">brouillons hebdomadaires</strong> correspondants — vous pourrez corriger semaine
          par semaine avant publication.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block">
            <span className={uiLabel}>Document (PDF ou image)</span>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,image/*"
              disabled={loading || disabled}
              className="mt-1 block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-stone-800 hover:file:bg-stone-200"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
          </label>

          <ul className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2 text-xs text-stone-600">
            <li>Semaine, multi-semaines ou mois entier : tout est importé automatiquement.</li>
            <li>Les noms doivent correspondre aux fiches équipe (accents et prénoms).</li>
            <li>Naviguez entre les semaines pour vérifier chaque brouillon, puis publiez.</li>
          </ul>

          {error ? <p className={uiError}>{error}</p> : null}

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={uiBtnOutlineSm} disabled={loading} onClick={handleClose}>
              Annuler
            </button>
            <button type="submit" className={uiBtnPrimarySm} disabled={loading || disabled || !file}>
              {loading ? "Analyse en cours…" : "Analyser et importer"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
