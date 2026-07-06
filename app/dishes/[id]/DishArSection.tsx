"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Box, Trash2 } from "lucide-react";
import { isEphemeralTripoModelUrl } from "@/lib/dishes/dishArShared";
import { clearDishArModel, pollDishArGeneration, rePersistDishArToSupabase, startDishArGeneration } from "./dishArActions";
import { DishArViewer } from "./DishArViewer";
import { uiBtnOutlineSm, uiBtnPrimary, uiCard, uiError, uiLead, uiMuted } from "@/components/ui/premium";

const POLL_MS = 5000;

type Props = {
  restaurantId: string;
  dishId: string;
  dishName: string;
  model3dUrl: string | null;
  model3dStatus: string | null;
  model3dError: string | null;
  sourceImageUrl: string | null;
};

export function DishArSection({
  restaurantId,
  dishId,
  dishName,
  model3dUrl: initialModelUrl,
  model3dStatus: initialStatus,
  model3dError: initialError,
  sourceImageUrl,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modelUrl, setModelUrl] = useState(initialModelUrl);
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(initialError);
  const [progress, setProgress] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState<string | null>(null);
  const [storageNote, setStorageNote] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollInFlightRef = useRef(false);
  const pollErrorCountRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const [elapsedMin, setElapsedMin] = useState(0);

  useEffect(() => {
    setModelUrl(initialModelUrl);
    setStatus(initialStatus);
    setError(initialError);
  }, [initialModelUrl, initialStatus, initialError]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const runPoll = useCallback(async () => {
    if (pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    try {
      const res = await pollDishArGeneration({ restaurantId, dishId });
      if (!res.ok) {
        pollErrorCountRef.current += 1;
        if (pollErrorCountRef.current >= 5) {
          setError(res.error);
          stopPolling();
        }
        return;
      }
      pollErrorCountRef.current = 0;
      const data = res.data!;
      setStatus(data.status);
      setProgress(data.progress);
      setPhaseLabel(data.phaseLabel);
      setStorageNote(data.storageNote);
      if (data.error) setError(data.error);
      if (data.model3dUrl) {
        setModelUrl(data.model3dUrl);
        setError(null);
        startedAtRef.current = null;
        stopPolling();
        router.refresh();
      }
      if (data.status === "failed" || data.status === "cancelled" || data.status === "expired") {
        startedAtRef.current = null;
        stopPolling();
      }
    } finally {
      pollInFlightRef.current = false;
    }
  }, [restaurantId, dishId, router, stopPolling]);

  const startPolling = useCallback(() => {
    if (!startedAtRef.current) startedAtRef.current = Date.now();
    stopPolling();
    void runPoll();
    pollRef.current = setInterval(() => void runPoll(), POLL_MS);
  }, [runPoll, stopPolling]);

  const isGenerating =
    status === "queued" || status === "running" || status === "refining" || pending;

  useEffect(() => {
    if (!isGenerating || !startedAtRef.current) return;
    const tick = () => {
      setElapsedMin(Math.floor((Date.now() - (startedAtRef.current ?? Date.now())) / 60000));
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [isGenerating]);

  // Reprend le suivi si l’utilisateur recharge la page pendant une génération Tripo.
  useEffect(() => {
    if (modelUrl) return;
    if (
      initialStatus !== "queued" &&
      initialStatus !== "running" &&
      initialStatus !== "refining"
    ) {
      return;
    }
    startPolling();
  }, [initialStatus, modelUrl, startPolling]);

  const onFileChange = (file: File | null) => {
    if (!file) return;
    setError(null);
    setPreviewUrl(URL.createObjectURL(file));

    const fd = new FormData();
    fd.set("restaurantId", restaurantId);
    fd.set("dishId", dishId);
    fd.set("photo", file);

    startTransition(async () => {
      const res = await startDishArGeneration(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStatus("queued");
      setProgress(0);
      startedAtRef.current = Date.now();
      setElapsedMin(0);
      startPolling();
    });
  };

  const handleClear = () => {
    if (!window.confirm("Supprimer le modèle 3D de ce plat ?")) return;
    setError(null);
    startTransition(async () => {
      const res = await clearDishArModel({ restaurantId, dishId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setModelUrl(null);
      setStatus(null);
      setPreviewUrl(null);
      stopPolling();
      router.refresh();
    });
  };

  const showRePersist =
    Boolean(modelUrl) &&
    (Boolean(storageNote?.includes("trop lourd")) || Boolean(modelUrl && isEphemeralTripoModelUrl(modelUrl)));

  const handleRePersist = () => {
    setError(null);
    startTransition(async () => {
      const res = await rePersistDishArToSupabase({ restaurantId, dishId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setModelUrl(res.data!.model3dUrl);
      setStorageNote(res.data!.storageNote);
      router.refresh();
    });
  };

  return (
    <section className={`${uiCard} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <Box className="h-4 w-4 text-copper-700" aria-hidden />
            Modèle 3D &amp; réalité augmentée
          </h2>
          <p className={`mt-1 ${uiLead}`}>
            Photographiez le plat : Tripo3D génère un modèle .glb texturé, visualisable en RA sur smartphone.
          </p>
        </div>
        {modelUrl ? (
          <button type="button" className={uiBtnOutlineSm} disabled={pending} onClick={handleClear}>
            <Trash2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Supprimer
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={uiBtnPrimary}
          disabled={isGenerating}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="mr-1.5 inline h-4 w-4" aria-hidden />
          {isGenerating ? "Génération en cours…" : "Prendre le plat en photo"}
        </button>
        <button
          type="button"
          className={uiBtnOutlineSm}
          disabled={isGenerating}
          onClick={() => {
            const input = inputRef.current;
            if (!input) return;
            input.removeAttribute("capture");
            input.click();
          }}
        >
          Choisir un fichier
        </button>
      </div>

      {/*
        capture="environment" : ouvre l’appareil photo arrière sur mobile (Safari / Chrome Android).
        accept limite aux formats supportés par Tripo3D.
      */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        disabled={isGenerating}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          onFileChange(f);
          e.target.value = "";
        }}
      />

      {(previewUrl || sourceImageUrl) && !modelUrl ? (
        <div>
          <p className={`mb-1 ${uiMuted}`}>Photo source</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl ?? sourceImageUrl ?? ""}
            alt={`Photo de ${dishName}`}
            className="max-h-48 rounded-xl border border-stone-200 object-cover"
          />
        </div>
      ) : null}

      {isGenerating ? (
        <div className="space-y-2 rounded-xl border border-copper-100 bg-copper-50/60 px-3 py-3">
          <p className="text-sm font-medium text-copper-900">
            {phaseLabel ?? "Tripo3D génère le modèle…"} {progress > 0 ? `${progress} %` : ""}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full bg-copper-600 transition-all duration-500"
              style={{ width: `${Math.max(progress, 8)}%` }}
            />
          </div>
          <p className={`text-xs ${uiMuted}`}>
            Vérification automatique toutes les {POLL_MS / 1000} secondes
            {elapsedMin > 0 ? ` · ${elapsedMin} min écoulée${elapsedMin > 1 ? "s" : ""}` : ""}.
            {status === "refining"
              ? " Étape 2 : textures HD (comme « Enhance » sur Tripo)."
              : null}
          </p>
          {elapsedMin >= 8 ? (
            <p className={`text-xs ${uiMuted}`}>
              Au-delà de 8 min, rechargez la page : le modèle sera récupéré automatiquement si Tripo l’a
              déjà généré.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className={uiError}>{error}</p> : null}

      {modelUrl ? (
        <div className="space-y-2">
          <p className={`${uiMuted}`}>
            Touchez l’icône RA sur le viewer pour projeter le plat en réalité augmentée (iOS Quick Look / Android
            Scene Viewer).
          </p>
          {storageNote ? (
            <p className={`text-xs ${storageNote.includes("optimisé") ? "text-green-800" : "text-amber-800"}`}>
              {storageNote}
            </p>
          ) : null}
          {showRePersist ? (
            <button type="button" className={uiBtnOutlineSm} disabled={pending} onClick={handleRePersist}>
              Optimiser et enregistrer sur Supabase
            </button>
          ) : null}
          <DishArViewer src={modelUrl} alt={`Modèle 3D — ${dishName}`} poster={sourceImageUrl} />
        </div>
      ) : (
        <p className={`text-sm ${uiMuted}`}>
          Aucun modèle 3D pour l’instant. Une fois généré, le bouton RA apparaît dans le viewer ci-dessus.
        </p>
      )}
    </section>
  );
}
