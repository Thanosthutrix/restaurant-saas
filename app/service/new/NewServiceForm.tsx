"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createServiceAndSales, analyzeReceiptAndMatch } from "./actions";
import type { AnalyzedTicketLine } from "./actions";
import { supabase } from "@/lib/supabaseClient";
import type { Dish } from "@/lib/db";
import type { ServiceType } from "@/lib/constants";
import { SERVICE_TYPES } from "@/lib/constants";

const BUCKET = "receipts";

const SERVICE_NEW_RESTORE_KEY = "serviceNewRestore";

type RestoredState = {
  date: string;
  serviceType: ServiceType;
  quantities: Record<string, number>;
  analysisLines: AnalyzedTicketLine[];
  resolvedLineIndices: number[];
  receiptImageUrl: string | null;
  selectedDishForLine: Record<string, string>;
  analyzeMessage: string | null;
};

/** Upload une image dans le bucket receipts et retourne l'URL publique, ou une erreur. */
async function uploadReceipt(
  file: File,
  restaurantId: string,
  serviceDate: string,
  serviceType: string
): Promise<{ url: string } | { error: string }> {
  const ext = file.type.includes("png") ? "png" : "jpg";
  const safeRandom = crypto.randomUUID().replace(/-/g, "");
  const path = `${restaurantId}/${serviceDate}-${serviceType}-${safeRandom}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

const TODAY = new Date().toISOString().slice(0, 10);

type Props = {
  restaurantId: string;
  dishes: Dish[];
};

export function NewServiceForm({ restaurantId, dishes }: Props) {
  const router = useRouter();
  const [date, setDate] = useState(TODAY);
  const [serviceType, setServiceType] = useState<ServiceType>("lunch");
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(dishes.map((d) => [d.id, 0]))
  );
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [analyzePending, setAnalyzePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeMessage, setAnalyzeMessage] = useState<string | null>(null);
  const [analysisLines, setAnalysisLines] = useState<AnalyzedTicketLine[] | null>(null);
  const [resolvedLineIndices, setResolvedLineIndices] = useState<Set<number>>(new Set());
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualAddDishId, setManualAddDishId] = useState("");
  const [selectedDishForLine, setSelectedDishForLine] = useState<Record<number, string>>({});

  useEffect(() => {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem(SERVICE_NEW_RESTORE_KEY) : null;
    if (!raw) return;
    try {
      sessionStorage.removeItem(SERVICE_NEW_RESTORE_KEY);
      const data = JSON.parse(raw) as RestoredState;
      if (data.date) setDate(data.date);
      if (data.serviceType) setServiceType(data.serviceType);
      if (data.quantities && typeof data.quantities === "object") {
        setQuantities({
          ...Object.fromEntries(dishes.map((d) => [d.id, 0])),
          ...data.quantities,
        });
      }
      if (data.analysisLines && Array.isArray(data.analysisLines)) setAnalysisLines(data.analysisLines);
      if (Array.isArray(data.resolvedLineIndices)) setResolvedLineIndices(new Set(data.resolvedLineIndices));
      if (data.receiptImageUrl) setReceiptImageUrl(data.receiptImageUrl);
      if (data.selectedDishForLine && typeof data.selectedDishForLine === "object") {
        const sel: Record<number, string> = {};
        Object.entries(data.selectedDishForLine).forEach(([k, v]) => {
          sel[Number(k)] = v;
        });
        setSelectedDishForLine(sel);
      }
      if (data.analyzeMessage != null) setAnalyzeMessage(data.analyzeMessage);
    } catch {
      // ignore invalid restore data
    }
  }, [dishes]);

  const updateQty = (dishId: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [dishId]: Math.max(0, (prev[dishId] ?? 0) + delta),
    }));
  };

  const dishesWithQty = dishes.filter((d) => (quantities[d.id] ?? 0) > 0);

  const handleAnalyzeReceipt = async () => {
    if (!receiptFile) {
      setAnalyzeError("Choisissez une photo de relevé avant de lancer l’analyse.");
      setAnalyzeMessage(null);
      return;
    }
    setAnalyzeError(null);
    setAnalyzeMessage(null);
    setAnalysisLines(null);
    setResolvedLineIndices(new Set());
    setSelectedDishForLine({});
    setAnalyzePending(true);
    const serviceDate = date;
    const uploadResult = await uploadReceipt(receiptFile, restaurantId, serviceDate, serviceType);
    if ("error" in uploadResult) {
      setAnalyzeError("Impossible d’envoyer la photo : " + uploadResult.error);
      setAnalyzePending(false);
      return;
    }
    const result = await analyzeReceiptAndMatch(restaurantId, uploadResult.url);
    setAnalyzePending(false);
    if (!result.success) {
      setAnalyzeError(result.error);
      return;
    }
    setReceiptImageUrl(uploadResult.url);
    setQuantities((prev) => {
      const next = { ...prev };
      for (const { dish_id, qty } of result.matchedSales) {
        next[dish_id] = (next[dish_id] ?? 0) + qty;
      }
      return next;
    });
    setAnalysisLines(result.lines);
    const matchedCount = result.matchedSales.length;
    const toAssociateCount = result.lines.filter((l) => l.status !== "matched").length;
    if (toAssociateCount > 0) {
      setAnalyzeMessage(
        `${matchedCount} vente(s) reconnue(s) et ajoutée(s). ${toAssociateCount} ligne(s) à associer ci‑dessous ou à saisir manuellement.`
      );
    } else {
      setAnalyzeMessage(`${result.totalDetected} vente(s) détectée(s) et ajoutée(s). Vous pouvez corriger les quantités ci‑dessous.`);
    }
  };

  const associateLineToDish = (line: AnalyzedTicketLine, dishId: string, lineIndex: number) => {
    updateQty(dishId, line.qty);
    setResolvedLineIndices((prev) => new Set(prev).add(lineIndex));
  };

  const saveStateAndGoToCreateDish = (dishName: string) => {
    const state: RestoredState = {
      date,
      serviceType,
      quantities,
      analysisLines: analysisLines ?? [],
      resolvedLineIndices: Array.from(resolvedLineIndices),
      receiptImageUrl,
      selectedDishForLine: { ...selectedDishForLine },
      analyzeMessage,
    };
    sessionStorage.setItem(SERVICE_NEW_RESTORE_KEY, JSON.stringify(state));
    router.push(
      `/dishes?name=${encodeURIComponent(dishName)}&returnTo=${encodeURIComponent("/service/new")}`
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUploadError(null);
    setPending(true);

    let imageUrl: string | null = null;
    if (receiptFile) {
      const uploadResult = await uploadReceipt(
        receiptFile,
        restaurantId,
        serviceDate,
        serviceType
      );
      if ("error" in uploadResult) {
        setUploadError(uploadResult.error);
      } else {
        imageUrl = uploadResult.url;
      }
    } else if (receiptImageUrl) {
      imageUrl = receiptImageUrl;
    }

    const sales = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([dish_id, qty]) => ({ dish_id, qty }));

    const result = await createServiceAndSales(
      restaurantId,
      serviceDate,
      serviceType,
      sales,
      imageUrl
    );
    if (!result.success) {
      setError(result.error);
      setPending(false);
      return;
    }
    // redirect() dans l'action en cas de succès
  };

  const serviceDate = date;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-slate-600 underline decoration-slate-400 underline-offset-2"
        >
          ← Tableau de bord
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-semibold text-slate-900">
        Nouveau service
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="date" className="mb-1 block text-sm font-medium text-slate-700">
            Date
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            required
          />
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Type de service
          </span>
          <div className="flex gap-4">
            {SERVICE_TYPES.map((type) => (
              <label key={type} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="serviceType"
                  value={type}
                  checked={serviceType === type}
                  onChange={() => setServiceType(type)}
                  className="h-4 w-4"
                />
                <span className="text-slate-800">
                  {type === "lunch" ? "Déjeuner" : "Dîner"}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <label
            htmlFor="receipt"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Relevé de caisse (optionnel)
          </label>
          <p className="mb-2 text-xs text-slate-500">
            Uploadez une photo pour analyser les ventes automatiquement, ou saisissez les quantités manuellement ci‑dessous.
          </p>
          <input
            id="receipt"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              setReceiptFile(e.target.files?.[0] ?? null);
              setAnalyzeError(null);
              setAnalyzeMessage(null);
            }}
            className="mb-3 w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-4 file:py-2 file:text-slate-800"
          />
          {receiptFile && (
            <p className="mb-3 text-xs text-slate-500">
              {receiptFile.name} ({(receiptFile.size / 1024).toFixed(1)} Ko)
            </p>
          )}
          {receiptImageUrl && !receiptFile && analysisLines && (
            <p className="mb-3 text-xs text-emerald-600">
              Relevé analysé en mémoire — vous pouvez continuer à associer les lignes ou enregistrer le service.
            </p>
          )}
          <button
            type="button"
            onClick={handleAnalyzeReceipt}
            disabled={analyzePending || !receiptFile}
            className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200 disabled:opacity-50"
          >
            {analyzePending ? "Analyse en cours…" : "Analyser le relevé"}
          </button>
          {analyzeError && (
            <p className="mt-2 text-sm text-red-600">{analyzeError}</p>
          )}
          {analyzeMessage && (
            <p className="mt-2 text-sm text-green-700">{analyzeMessage}</p>
          )}
        </div>

        {analysisLines && analysisLines.some((l, i) => l.status !== "matched" && !resolvedLineIndices.has(i)) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h2 className="mb-2 text-sm font-medium text-amber-800">
              Lignes à associer
            </h2>
            <p className="mb-3 text-xs text-amber-700">
              Associez chaque ligne à un plat (suggestion ou choix manuel) ou créez un nouveau plat.
            </p>
            <ul className="space-y-3">
              {analysisLines
                .map((line, lineIndex) => ({ line, lineIndex }))
                .filter(({ line, lineIndex }) => line.status !== "matched" && !resolvedLineIndices.has(lineIndex))
                .map(({ line, lineIndex }) => (
                  <li
                    key={lineIndex}
                    className="flex flex-col gap-2 rounded border border-amber-200 bg-white p-2"
                  >
                    <span className="font-medium text-slate-900">
                      « {line.raw_label} » × {line.qty}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {line.suggestions.length > 0 && (
                        <span className="flex flex-wrap gap-1.5">
                          {line.suggestions.map((s) => (
                            <button
                              key={s.dish_id}
                              type="button"
                              onClick={() => associateLineToDish(line, s.dish_id, lineIndex)}
                              className="rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700"
                            >
                              Ajouter à {s.dish_name}
                            </button>
                          ))}
                        </span>
                      )}
                      <span className="flex flex-wrap items-center gap-1.5">
                        <select
                          value={selectedDishForLine[lineIndex] ?? ""}
                          onChange={(e) =>
                            setSelectedDishForLine((prev) => ({ ...prev, [lineIndex]: e.target.value }))
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                          aria-label="Associer à un plat"
                        >
                          <option value="">Choisir un plat…</option>
                          {dishes.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const dishId = selectedDishForLine[lineIndex];
                            if (dishId) associateLineToDish(line, dishId, lineIndex);
                          }}
                          disabled={!selectedDishForLine[lineIndex]}
                          className="rounded border border-slate-400 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-200 disabled:opacity-50"
                        >
                          Associer à ce plat
                        </button>
                      </span>
                      <button
                        type="button"
                        onClick={() => saveStateAndGoToCreateDish(line.raw_label)}
                        className="text-xs text-slate-600 underline hover:text-slate-800"
                      >
                        Créer un nouveau plat
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        )}

        <div>
          <h2 className="mb-3 text-sm font-medium text-slate-700">
            Quantités vendues par plat
          </h2>
          {dishes.length === 0 ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Aucun plat pour ce restaurant. Créez des plats dans <Link href="/dishes" className="underline">Plats</Link>.
            </p>
          ) : (
            <>
              {dishesWithQty.length === 0 && !showManualAdd && (
                <p className="mb-3 text-sm text-slate-500">
                  Aucune vente pour l’instant. Analysez un relevé ou ajoutez des ventes manuellement.
                </p>
              )}
              {dishesWithQty.length > 0 && (
                <ul className="mb-4 space-y-3">
                  {dishesWithQty.map((dish) => (
                    <li
                      key={dish.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <span className="font-medium text-slate-900">{dish.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQty(dish.id, -1)}
                          disabled={(quantities[dish.id] ?? 0) === 0}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-lg font-medium text-slate-700 disabled:opacity-40"
                          aria-label={`Diminuer ${dish.name}`}
                        >
                          −
                        </button>
                        <span className="min-w-[2rem] text-center text-slate-900">
                          {quantities[dish.id] ?? 0}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(dish.id, 1)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-lg font-medium text-slate-700"
                          aria-label={`Augmenter ${dish.name}`}
                        >
                          +
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!showManualAdd ? (
                <button
                  type="button"
                  onClick={() => setShowManualAdd(true)}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
                >
                  Ajouter des ventes manuellement
                </button>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                  <p className="mb-2 text-xs font-medium text-slate-600">
                    Ajouter un plat au récap
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-slate-500">Plat</span>
                      <select
                        value={manualAddDishId}
                        onChange={(e) => setManualAddDishId(e.target.value)}
                        className="min-w-[180px] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      >
                        <option value="">Choisir un plat</option>
                        {dishes.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (manualAddDishId) {
                          updateQty(manualAddDishId, 1);
                          setManualAddDishId("");
                        }
                      }}
                      disabled={!manualAddDishId}
                      className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      Ajouter (×1)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManualAdd(false)}
                      className="text-sm text-slate-500 underline hover:text-slate-700"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {uploadError && (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Photo non enregistrée : {uploadError}. Le service sera enregistré sans photo.
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending || dishes.length === 0}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : "Enregistrer le service"}
        </button>
      </form>
    </div>
  );
}
