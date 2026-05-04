"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importOnboardingBusinessDocuments } from "@/app/onboarding/imports/actions";
import {
  PENDING_ONBOARDING_PURCHASE_PRICES_KEY,
  type PendingOnboardingPurchasePricesStored,
} from "@/lib/onboardingPendingMenuStorage";
import {
  uiBtnOutlineSm,
  uiBtnPrimaryBlock,
  uiBtnSecondary,
  uiError,
  uiFileInput,
  uiMuted,
  uiSectionTitleSm,
  uiSelect,
  uiSuccess,
} from "@/components/ui/premium";

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
          placeholder="ex. Métro, grossiste…"
          disabled={Boolean(supplierId)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </label>
    </div>
  );
}

export function UploadSupplierDocumentsClient({ suppliers }: { suppliers: SupplierOption[] }) {
  const router = useRouter();
  const [deliverySupplierId, setDeliverySupplierId] = useState("");
  const [deliverySupplierName, setDeliverySupplierName] = useState("");
  const [invoiceSupplierId, setInvoiceSupplierId] = useState("");
  const [invoiceSupplierName, setInvoiceSupplierName] = useState("");
  const [deliveryFiles, setDeliveryFiles] = useState<File[]>([]);
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    deliveryNotesCreated: number;
    supplierInvoicesCreated: number;
    errors: string[];
  } | null>(null);

  function goToRevenueStep() {
    router.push("/onboarding/upload-revenue-statements");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (deliveryFiles.length === 0 && invoiceFiles.length === 0) {
      setError("Ajoutez au moins un fichier, ou utilisez « Passer cette étape ».");
      return;
    }

    setPending(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("delivery_supplier_id", deliverySupplierId);
    formData.append("delivery_supplier_name", deliverySupplierName);
    formData.append("invoice_supplier_id", invoiceSupplierId);
    formData.append("invoice_supplier_name", invoiceSupplierName);
    for (const file of deliveryFiles) formData.append("delivery_note_file", file);
    for (const file of invoiceFiles) formData.append("supplier_invoice_file", file);

    const res = await importOnboardingBusinessDocuments(formData);
    setPending(false);

    const anyImport = res.deliveryNotesCreated + res.supplierInvoicesCreated > 0;
    if (!res.ok && !anyImport) {
      setError(res.errors.join(" ") || "Import impossible.");
      return;
    }

    setResult({
      deliveryNotesCreated: res.deliveryNotesCreated,
      supplierInvoicesCreated: res.supplierInvoicesCreated,
      errors: res.errors,
    });
    setDeliveryFiles([]);
    setInvoiceFiles([]);

    if (res.purchasePriceSuggestions.length > 0) {
      try {
        const payload: PendingOnboardingPurchasePricesStored = {
          v: 1,
          items: res.purchasePriceSuggestions,
        };
        sessionStorage.setItem(PENDING_ONBOARDING_PURCHASE_PRICES_KEY, JSON.stringify(payload));
      } catch {
        setError("Les fichiers sont importés, mais les tarifs détectés n’ont pas pu être conservés localement.");
        return;
      }
      router.push("/onboarding/review-purchase-prices");
      return;
    }

    goToRevenueStep();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className={uiSectionTitleSm}>Factures et bons de livraison</h2>
        <p className={`mt-1 ${uiMuted}`}>
          Les <strong className="font-medium text-slate-800">factures</strong> sont analysées pour proposer des{" "}
          <strong className="font-medium text-slate-800">tarifs d’achat</strong> et enrichir les fiches fournisseurs
          (coordonnées, SIRET… quand ils figurent sur le document). Laissez fournisseur vide pour laisser l’IA
          rapprocher ou créer le fournisseur à partir de chaque facture. Les <strong className="font-medium text-slate-800">BL</strong>{" "}
          exigent un fournisseur choisi ou nommé.
        </p>
      </div>

      {error ? <p className={uiError}>{error}</p> : null}
      {result ? (
        <div className={uiSuccess}>
          {result.deliveryNotesCreated} BL créé(s), {result.supplierInvoicesCreated} facture(s) importée(s).
          {result.errors.length > 0 ? (
            <p className="mt-2 text-sm">Points à vérifier : {result.errors.join(" ; ")}</p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Bons de livraison (optionnel)</h3>
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
            disabled={pending}
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
          <h3 className="text-sm font-semibold text-slate-900">Factures fournisseurs (recommandé)</h3>
          <SupplierPicker
            label="Fournisseur des factures"
            suppliers={suppliers}
            supplierId={invoiceSupplierId}
            setSupplierId={setInvoiceSupplierId}
            supplierName={invoiceSupplierName}
            setSupplierName={setInvoiceSupplierName}
          />
          <p className={`text-[11px] leading-snug ${uiMuted}`}>
            Laissez « Nouveau fournisseur » et le nom vides : chaque fichier est analysé et le fournisseur est rapproché
            ou créé automatiquement.
          </p>
          <input
            type="file"
            accept=".pdf,image/*"
            multiple
            disabled={pending}
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

        <button type="submit" disabled={pending} className={uiBtnPrimaryBlock}>
          {pending ? "Import et analyse…" : "Importer et continuer"}
        </button>
      </form>

      <button type="button" onClick={goToRevenueStep} className={uiBtnSecondary}>
        Passer cette étape
      </button>
    </div>
  );
}
