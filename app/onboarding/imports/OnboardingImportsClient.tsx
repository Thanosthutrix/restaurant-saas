"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OptionalMenuPhotosPicker } from "@/components/restaurant/OptionalMenuPhotosPicker";
import {
  PENDING_ONBOARDING_MENU_KEY,
  PENDING_ONBOARDING_EQUIPMENT_KEY,
  PENDING_ONBOARDING_PURCHASE_PRICES_KEY,
  PENDING_ONBOARDING_RECIPES_KEY,
  type PendingOnboardingMenuStored,
  type PendingOnboardingEquipmentStored,
  type PendingOnboardingPurchasePricesStored,
  type PendingOnboardingRecipesStored,
} from "@/lib/onboardingPendingMenuStorage";
import {
  uiBtnOutlineSm,
  uiBtnPrimaryBlock,
  uiCard,
  uiError,
  uiFileInput,
  uiMuted,
  uiSectionTitleSm,
  uiSelect,
  uiSuccess,
} from "@/components/ui/premium";
import { analyzeOnboardingImportDocuments, importOnboardingBusinessDocuments } from "./actions";

type SupplierOption = { id: string; name: string };

function fileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function mergeFiles(current: File[], list: FileList | null): File[] {
  if (!list?.length) return current;
  const map = new Map<string, File>();
  for (const file of current) map.set(fileKey(file), file);
  for (const file of Array.from(list)) map.set(fileKey(file), file);
  return [...map.values()];
}

function FilesList({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  if (files.length === 0) return null;
  return (
    <ul className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">
      {files.map((file, index) => (
        <li key={fileKey(file)} className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate" title={file.name}>
            {file.name}
          </span>
          <button type="button" onClick={() => onRemove(index)} className={uiBtnOutlineSm}>
            Retirer
          </button>
        </li>
      ))}
    </ul>
  );
}

function SupplierPicker({
  label,
  suppliers,
  supplierId,
  setSupplierId,
  supplierName,
  setSupplierName,
}: {
  label: string;
  suppliers: SupplierOption[];
  supplierId: string;
  setSupplierId: (value: string) => void;
  supplierName: string;
  setSupplierName: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={`w-full ${uiSelect}`}>
          <option value="">Nouveau fournisseur…</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Nom si nouveau fournisseur</span>
        <input
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          placeholder="ex. Métro, Transgourmet, boulanger…"
          disabled={Boolean(supplierId)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </label>
    </div>
  );
}

export function OnboardingImportsClient({ suppliers }: { suppliers: SupplierOption[] }) {
  const router = useRouter();
  const [menuFiles, setMenuFiles] = useState<File[]>([]);
  const [recipeFiles, setRecipeFiles] = useState<File[]>([]);
  const [equipmentFiles, setEquipmentFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessPending, setBusinessPending] = useState(false);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [businessResult, setBusinessResult] = useState<{
    deliveryNotesCreated: number;
    supplierInvoicesCreated: number;
    revenueMonthsImported: number;
    errors: string[];
  } | null>(null);
  const [deliverySupplierId, setDeliverySupplierId] = useState("");
  const [deliverySupplierName, setDeliverySupplierName] = useState("");
  const [invoiceSupplierId, setInvoiceSupplierId] = useState("");
  const [invoiceSupplierName, setInvoiceSupplierName] = useState("");
  const [deliveryFiles, setDeliveryFiles] = useState<File[]>([]);
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [revenueFiles, setRevenueFiles] = useState<File[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (menuFiles.length === 0 && recipeFiles.length === 0 && equipmentFiles.length === 0) {
      setError("Ajoutez au moins une photo de carte, de recette ou de matériel.");
      return;
    }

    const formData = new FormData();
    for (const file of menuFiles) formData.append("menu_image", file);
    for (const file of recipeFiles) formData.append("recipe_image", file);
    for (const file of equipmentFiles) formData.append("equipment_image", file);

    setPending(true);
    const result = await analyzeOnboardingImportDocuments(formData);
    setPending(false);
    if (!result.ok) {
      setError(result.errors.join(" ") || "Analyse impossible.");
      return;
    }

    try {
      if (result.recipeSuggestions) {
        const payload: PendingOnboardingRecipesStored = { v: 1, items: result.recipeSuggestions };
        sessionStorage.setItem(PENDING_ONBOARDING_RECIPES_KEY, JSON.stringify(payload));
      }
      if (result.menuSuggestions) {
        const payload: PendingOnboardingMenuStored = { v: 1, items: result.menuSuggestions };
        sessionStorage.setItem(PENDING_ONBOARDING_MENU_KEY, JSON.stringify(payload));
      }
      if (result.equipmentSuggestions) {
        const payload: PendingOnboardingEquipmentStored = { v: 1, items: result.equipmentSuggestions };
        sessionStorage.setItem(PENDING_ONBOARDING_EQUIPMENT_KEY, JSON.stringify(payload));
      }
    } catch {
      setError("Impossible de conserver les suggestions localement. Réessayez avec moins de fichiers.");
      return;
    }

    if (result.menuSuggestions) {
      router.push("/onboarding/review-menu");
      return;
    }
    if (result.recipeSuggestions) {
      router.push("/onboarding/review-recipes");
      return;
    }
    if (result.equipmentSuggestions) {
      router.push("/onboarding/review-equipment");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function submitBusinessImports(e: React.FormEvent) {
    e.preventDefault();
    setBusinessError(null);
    setBusinessResult(null);
    if (deliveryFiles.length === 0 && invoiceFiles.length === 0 && revenueFiles.length === 0) {
      setBusinessError("Ajoutez au moins un BL, une facture ou un relevé de CA.");
      return;
    }

    const formData = new FormData();
    formData.append("delivery_supplier_id", deliverySupplierId);
    formData.append("delivery_supplier_name", deliverySupplierName);
    formData.append("invoice_supplier_id", invoiceSupplierId);
    formData.append("invoice_supplier_name", invoiceSupplierName);
    for (const file of deliveryFiles) formData.append("delivery_note_file", file);
    for (const file of invoiceFiles) formData.append("supplier_invoice_file", file);
    for (const file of revenueFiles) formData.append("revenue_statement_image", file);

    setBusinessPending(true);
    const result = await importOnboardingBusinessDocuments(formData);
    setBusinessPending(false);
    if (!result.ok) {
      setBusinessError(result.errors.join(" ") || "Import impossible.");
      return;
    }
    setBusinessResult({
      deliveryNotesCreated: result.deliveryNotesCreated,
      supplierInvoicesCreated: result.supplierInvoicesCreated,
      revenueMonthsImported: result.revenueMonthsImported,
      errors: result.errors,
    });
    setDeliveryFiles([]);
    setInvoiceFiles([]);
    setRevenueFiles([]);
    if (result.purchasePriceSuggestions.length > 0) {
      try {
        const payload: PendingOnboardingPurchasePricesStored = {
          v: 1,
          items: result.purchasePriceSuggestions,
        };
        sessionStorage.setItem(PENDING_ONBOARDING_PURCHASE_PRICES_KEY, JSON.stringify(payload));
      } catch {
        setBusinessError("Les factures sont importées, mais les tarifs détectés n’ont pas pu être conservés localement.");
        return;
      }
      router.push("/onboarding/review-purchase-prices");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <p className={uiMuted}>
        Relancez une partie de l’onboarding quand la carte, les recettes ou l’organisation changent. Les validations
        restent manuelles avant création.
      </p>

      <form onSubmit={submit} className={`${uiCard} space-y-5`}>
        <div>
          <h2 className={uiSectionTitleSm}>Carte, recettes et matériel</h2>
          <p className={`mt-1 ${uiMuted}`}>
            Carte = plats, rubriques, prix et type. Recettes = ingrédients et quantités. Matériel = base hygiène et salle.
          </p>
        </div>
        {error ? <p className={uiError}>{error}</p> : null}
        <OptionalMenuPhotosPicker files={menuFiles} onChange={setMenuFiles} disabled={pending} />
        <OptionalMenuPhotosPicker
          files={recipeFiles}
          onChange={setRecipeFiles}
          disabled={pending}
          title="Photo(s) de recettes"
          description="Ajoutez des fiches recettes ou notes de cuisine. Les recettes détectées seront proposées en validation."
          galleryLabel="Fiches recettes depuis la galerie"
          cameraLabel="Photographier une recette"
        />
        <OptionalMenuPhotosPicker
          files={equipmentFiles}
          onChange={setEquipmentFiles}
          disabled={pending}
          title="Photo(s) matériel cuisine / salle"
          description="Ajoutez des photos de la cuisine, réserve, bar ou salle. L’IA proposera le matériel à créer pour préparer hygiène et salle."
          galleryLabel="Photos matériel depuis la galerie"
          cameraLabel="Photographier le matériel"
        />
        <button type="submit" disabled={pending} className={uiBtnPrimaryBlock}>
          {pending ? "Analyse en cours…" : "Analyser carte / recettes / matériel"}
        </button>
      </form>

      <form onSubmit={submitBusinessImports} className={`${uiCard} space-y-5`}>
        <div>
          <h2 className={uiSectionTitleSm}>BL, factures fournisseurs et CA</h2>
          <p className={`mt-1 ${uiMuted}`}>
            Les BL et factures alimentent les registres existants. Les relevés de CA créent un historique mensuel pour
            les futures projections.
          </p>
        </div>

        {businessError ? <p className={uiError}>{businessError}</p> : null}
        {businessResult ? (
          <div className={uiSuccess}>
            {businessResult.deliveryNotesCreated} BL créé(s), {businessResult.supplierInvoicesCreated} facture(s)
            créée(s), {businessResult.revenueMonthsImported} mois de CA importé(s).
            {businessResult.errors.length > 0 ? (
              <p className="mt-2">Points à vérifier : {businessResult.errors.join(" ; ")}</p>
            ) : null}
          </div>
        ) : null}

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Bons de livraison</h3>
          <SupplierPicker
            label="Fournisseur des BL"
            suppliers={suppliers}
            supplierId={deliverySupplierId}
            setSupplierId={setDeliverySupplierId}
            supplierName={deliverySupplierName}
            setSupplierName={setDeliverySupplierName}
          />
          <input
            type="file"
            accept=".pdf,image/*"
            multiple
            disabled={businessPending}
            onChange={(e) => {
              setDeliveryFiles((prev) => mergeFiles(prev, e.target.files));
              e.target.value = "";
            }}
            className={uiFileInput}
          />
          <FilesList
            files={deliveryFiles}
            onRemove={(index) => setDeliveryFiles((prev) => prev.filter((_, i) => i !== index))}
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Factures fournisseurs</h3>
          <SupplierPicker
            label="Fournisseur des factures"
            suppliers={suppliers}
            supplierId={invoiceSupplierId}
            setSupplierId={setInvoiceSupplierId}
            supplierName={invoiceSupplierName}
            setSupplierName={setInvoiceSupplierName}
          />
          <input
            type="file"
            accept=".pdf,image/*"
            multiple
            disabled={businessPending}
            onChange={(e) => {
              setInvoiceFiles((prev) => mergeFiles(prev, e.target.files));
              e.target.value = "";
            }}
            className={uiFileInput}
          />
          <FilesList
            files={invoiceFiles}
            onRemove={(index) => setInvoiceFiles((prev) => prev.filter((_, i) => i !== index))}
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Relevés mensuels de CA</h3>
          <p className={uiMuted}>
            Import image pour l’instant : relevé mensuel, export caisse ou tableau de CA. Les PDF pourront être ajoutés
            ensuite.
          </p>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={businessPending}
            onChange={(e) => {
              setRevenueFiles((prev) => mergeFiles(prev, e.target.files));
              e.target.value = "";
            }}
            className={uiFileInput}
          />
          <FilesList
            files={revenueFiles}
            onRemove={(index) => setRevenueFiles((prev) => prev.filter((_, i) => i !== index))}
          />
        </section>

        <button type="submit" disabled={businessPending} className={uiBtnPrimaryBlock}>
          {businessPending ? "Import et analyse en cours…" : "Importer BL, factures et CA"}
        </button>
      </form>
    </div>
  );
}
