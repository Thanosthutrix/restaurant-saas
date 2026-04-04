"use client";

import { useState } from "react";
import Link from "next/link";
import { createDishesFromMenuSuggestions } from "./actions";
import type { MenuSuggestionItem } from "@/lib/menuSuggestionTypes";
import {
  MenuSuggestionsEditor,
  menuItemsToEditableRows,
  type MenuSuggestionRow,
} from "@/components/menu/MenuSuggestionsEditor";
import {
  fetchMenuAnalysisFromStoragePath,
  MENU_IMPORT_STORAGE_BUCKET,
  uploadMenuImageForRestaurant,
} from "@/lib/menuImportClient";
import {
  uiBackLink,
  uiBtnPrimary,
  uiCard,
  uiError,
  uiFileInput,
  uiLead,
  uiMuted,
  uiPageTitle,
  uiSectionTitleSm,
} from "@/components/ui/premium";

export function ImportMenuClient({ restaurantId }: { restaurantId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [suggestions, setSuggestions] = useState<MenuSuggestionRow[]>([]);
  const [uploadPending, setUploadPending] = useState(false);
  const [analyzePending, setAnalyzePending] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createResult, setCreateResult] = useState<{
    created: number;
    skipped: number;
    draftRecipes: number;
    errors: string[];
  } | null>(null);

  const handleUploadAndAnalyze = async () => {
    if (!file) {
      setError("Choisissez une photo de carte.");
      return;
    }
    setError(null);
    setCreateResult(null);
    setUploadPending(true);
    const uploadResult = await uploadMenuImageForRestaurant(file, restaurantId);
    setUploadPending(false);
    if ("error" in uploadResult) {
      setError(uploadResult.error);
      return;
    }
    setAnalyzePending(true);
    setError(null);
    try {
      const { items, error: errMsg } = await fetchMenuAnalysisFromStoragePath(
        MENU_IMPORT_STORAGE_BUCKET,
        uploadResult.path
      );
      if (errMsg) {
        setError(errMsg);
        setSuggestions([]);
        return;
      }
      const rows = menuItemsToEditableRows(items as MenuSuggestionItem[]);
      setSuggestions(rows);
      if (rows.length === 0) {
        setError("Aucune suggestion trouvée. Réessayez avec une autre photo ou un menu plus lisible.");
      } else {
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
      setSuggestions([]);
    } finally {
      setAnalyzePending(false);
    }
  };

  const handleCreate = async () => {
    const payload = suggestions.map((s) => ({
      raw_label: s.raw_label,
      selected: s.selected,
      suggested_mode: s.suggested_mode,
      selling_price_ttc: s.selling_price_ttc,
      selling_vat_rate_pct: s.selling_vat_rate_pct,
      suggested_ingredients: (s.suggested_ingredients ?? []).filter(
        (ing) => typeof ing === "string" && ing.trim().length > 0
      ),
      create_draft_recipe: Boolean(s.create_draft_recipe),
    }));
    setCreatePending(true);
    setCreateResult(null);
    const result = await createDishesFromMenuSuggestions(payload);
    setCreatePending(false);
    if (!result.success) {
      setError(result.errors.join(" "));
      return;
    }
    setCreateResult({
      created: result.created,
      skipped: result.skipped,
      draftRecipes: result.draftRecipes ?? 0,
      errors: result.errors,
    });
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dishes" className={uiBackLink}>
          ← Plats vendus
        </Link>
      </div>

      <div>
        <h1 className={uiPageTitle}>Importer depuis une photo de carte</h1>
        <p className={`mt-2 ${uiLead}`}>
          Uploadez une ou plusieurs photos de votre carte ou menu. L’IA extrait des suggestions de plats, composants et
          prix TTC et TVA. Vous validez avant création (aucune création automatique).
        </p>
      </div>

      <div className={uiCard}>
        <label className={`mb-2 block ${uiSectionTitleSm}`}>Photo de la carte</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setSuggestions([]);
            setCreateResult(null);
          }}
          className={`mb-3 ${uiFileInput}`}
        />
        {file && (
          <p className={`mb-3 ${uiMuted}`}>
            {file.name} ({(file.size / 1024).toFixed(1)} Ko)
          </p>
        )}
        <button
          type="button"
          onClick={handleUploadAndAnalyze}
          disabled={!file || uploadPending || analyzePending}
          className={uiBtnPrimary}
        >
          {uploadPending ? "Upload…" : analyzePending ? "Analyse en cours…" : "Analyser la carte"}
        </button>
      </div>

      {error && suggestions.length === 0 && <div className={uiError}>{error}</div>}

      <MenuSuggestionsEditor
        suggestions={suggestions}
        setSuggestions={setSuggestions}
        onCreate={handleCreate}
        createPending={createPending}
        createResult={createResult}
        error={suggestions.length > 0 ? error : null}
      />
    </div>
  );
}
