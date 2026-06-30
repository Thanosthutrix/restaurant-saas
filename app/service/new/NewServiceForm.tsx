"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChefHat, Minus, Plus, ScanLine, Soup, UtensilsCrossed } from "lucide-react";
import { createServiceAndSales, analyzeReceiptAndMatch } from "./actions";
import type { AnalyzedTicketLine } from "./actions";
import { supabase } from "@/lib/supabaseClient";
import type { Dish } from "@/lib/db";
import type { ServiceType } from "@/lib/constants";
import { SERVICE_TYPES } from "@/lib/constants";
import { uiBtnPrimary, uiBtnSecondary, uiCard, uiFileInput, uiInput, uiLabel } from "@/components/ui/premium";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { SECTION_ACCENT } from "@/lib/ui/sectionAccents";

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

  const totalQty = dishesWithQty.reduce((sum, d) => sum + (quantities[d.id] ?? 0), 0);

  return (
    <PageContainer width="narrow">
      <PageHeader
        accentIcon={SECTION_ACCENT.service.icon}
        accentTone={SECTION_ACCENT.service.tone}
        breadcrumbs={[{ label: "Cuisine", href: "/cuisine" }, { label: "Nouveau service" }]}
        title="Nouveau service"
        subtitle="Saisissez les ventes du service — par photo de relevé (lecture automatique) ou à la main."
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Date + type de service */}
        <div className={`${uiCard} space-y-4`}>
          <div className="flex flex-col gap-1">
            <label htmlFor="date" className={uiLabel}>
              Date
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${uiInput} h-11 w-full sm:w-56`}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className={uiLabel}>Type de service</span>
            <div className="inline-flex h-11 items-center gap-1 self-start rounded-xl border border-stone-200 bg-stone-50 p-1">
              {SERVICE_TYPES.map((type) => {
                const on = serviceType === type;
                const TypeIcon = type === "lunch" ? Soup : UtensilsCrossed;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setServiceType(type)}
                    className={`flex h-full items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition ${
                      on ? "bg-white text-copper-800 shadow-sm ring-1 ring-stone-200" : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    <TypeIcon className="h-4 w-4" aria-hidden />
                    {type === "lunch" ? "Déjeuner" : "Dîner"}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Relevé de caisse */}
        <div className={`${uiCard} space-y-3`}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-copper-50 text-copper-700 ring-1 ring-copper-100/90">
              <ScanLine className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-stone-900">Relevé de caisse (optionnel)</h2>
              <p className="text-xs text-stone-500">Photo → lecture automatique des ventes, ou saisie manuelle plus bas.</p>
            </div>
          </div>

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
            className={uiFileInput}
          />
          {receiptFile && (
            <p className="text-xs text-stone-500">
              {receiptFile.name} ({(receiptFile.size / 1024).toFixed(1)} Ko)
            </p>
          )}
          {receiptImageUrl && !receiptFile && analysisLines && (
            <p className="text-xs text-emerald-700">
              Relevé analysé — vous pouvez associer les lignes ou enregistrer le service.
            </p>
          )}
          <button
            type="button"
            onClick={handleAnalyzeReceipt}
            disabled={analyzePending || !receiptFile}
            className={`${uiBtnSecondary} inline-flex items-center gap-1.5`}
          >
            <ScanLine className="h-4 w-4" aria-hidden />
            {analyzePending ? "Analyse en cours…" : "Analyser le relevé"}
          </button>
          {analyzeError && <p className="text-sm text-rose-600">{analyzeError}</p>}
          {analyzeMessage && <p className="text-sm text-emerald-700">{analyzeMessage}</p>}
        </div>

        {/* Lignes à associer */}
        {analysisLines && analysisLines.some((l, i) => l.status !== "matched" && !resolvedLineIndices.has(i)) && (
          <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
            <div>
              <h2 className="text-sm font-semibold text-amber-900">Lignes à associer</h2>
              <p className="mt-0.5 text-xs text-amber-700">
                Associez chaque ligne à un plat (suggestion ou choix manuel) ou créez un nouveau plat.
              </p>
            </div>
            <ul className="space-y-2">
              {analysisLines
                .map((line, lineIndex) => ({ line, lineIndex }))
                .filter(({ line, lineIndex }) => line.status !== "matched" && !resolvedLineIndices.has(lineIndex))
                .map(({ line, lineIndex }) => (
                  <li key={lineIndex} className="flex flex-col gap-2 rounded-xl border border-amber-200/80 bg-white p-3">
                    <span className="font-semibold text-stone-900">
                      « {line.raw_label} » <span className="text-stone-500">× {line.qty}</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {line.suggestions.map((s) => (
                        <button
                          key={s.dish_id}
                          type="button"
                          onClick={() => associateLineToDish(line, s.dish_id, lineIndex)}
                          className="inline-flex items-center gap-1 rounded-lg bg-copper-700 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-copper-600"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          {s.dish_name}
                        </button>
                      ))}
                      <span className="flex flex-wrap items-center gap-1.5">
                        <select
                          value={selectedDishForLine[lineIndex] ?? ""}
                          onChange={(e) =>
                            setSelectedDishForLine((prev) => ({ ...prev, [lineIndex]: e.target.value }))
                          }
                          className={`${uiInput} h-9 py-0 text-xs`}
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
                          className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
                        >
                          Associer
                        </button>
                      </span>
                      <button
                        type="button"
                        onClick={() => saveStateAndGoToCreateDish(line.raw_label)}
                        className="text-xs font-semibold text-copper-700 underline-offset-2 hover:underline"
                      >
                        + Nouveau plat
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* Quantités vendues */}
        <div className={`${uiCard} space-y-3`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-stone-900">Quantités vendues</h2>
            {totalQty > 0 ? (
              <span className="rounded-full bg-copper-50 px-2.5 py-1 text-xs font-semibold text-copper-800">
                {totalQty} vendu{totalQty > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>

          {dishes.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Aucun plat pour ce restaurant. Créez des plats dans{" "}
              <Link href="/dishes" className="font-semibold underline">
                Plats
              </Link>
              .
            </p>
          ) : (
            <>
              {dishesWithQty.length === 0 && !showManualAdd && (
                <p className="text-sm text-stone-500">
                  Aucune vente pour l’instant. Analysez un relevé ou ajoutez des ventes manuellement.
                </p>
              )}
              {dishesWithQty.length > 0 && (
                <ul className="space-y-2">
                  {dishesWithQty.map((dish) => (
                    <li
                      key={dish.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-stone-200/70 bg-white px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-stone-900">{dish.name}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateQty(dish.id, -1)}
                          disabled={(quantities[dish.id] ?? 0) === 0}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-50 active:scale-95 disabled:opacity-40"
                          aria-label={`Diminuer ${dish.name}`}
                        >
                          <Minus className="h-4 w-4" aria-hidden />
                        </button>
                        <span className="min-w-[2rem] text-center text-base font-semibold tabular-nums text-stone-900">
                          {quantities[dish.id] ?? 0}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(dish.id, 1)}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-50 active:scale-95"
                          aria-label={`Augmenter ${dish.name}`}
                        >
                          <Plus className="h-4 w-4" aria-hidden />
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
                  className={`${uiBtnSecondary} inline-flex items-center gap-1.5`}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Ajouter un plat
                </button>
              ) : (
                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                  <p className="mb-2 text-xs font-medium text-stone-600">Ajouter un plat au récap</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1">
                      <span className={uiLabel}>Plat</span>
                      <select
                        value={manualAddDishId}
                        onChange={(e) => setManualAddDishId(e.target.value)}
                        className={`${uiInput} h-10 min-w-[180px]`}
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
                      className={`${uiBtnPrimary} h-10`}
                    >
                      Ajouter
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManualAdd(false)}
                      className="h-10 px-2 text-sm font-medium text-stone-500 hover:text-stone-700"
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
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Photo non enregistrée : {uploadError}. Le service sera enregistré sans photo.
          </p>
        )}
        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
        )}

        <button
          type="submit"
          disabled={pending || dishes.length === 0}
          className={`${uiBtnPrimary} min-h-[52px] w-full text-base`}
        >
          <ChefHat className="mr-1.5 inline h-5 w-5 align-[-3px]" aria-hidden />
          {pending ? "Enregistrement…" : "Enregistrer le service"}
        </button>
      </form>
    </PageContainer>
  );
}
