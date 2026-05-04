"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { importOnboardingRevenueDocuments } from "@/app/onboarding/imports/actions";
import { navigateToNextOnboardingAfterRevenueStep } from "@/lib/onboardingPostCategoriesFlow";
import {
  uiBtnOutlineSm,
  uiBtnPrimaryBlock,
  uiBtnSecondary,
  uiError,
  uiFileInput,
  uiMuted,
  uiSectionTitleSm,
} from "@/components/ui/premium";

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

export function UploadRevenueStatementsClient() {
  const router = useRouter();
  const [revenueFiles, setRevenueFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function finishSkip() {
    navigateToNextOnboardingAfterRevenueStep(router);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (revenueFiles.length === 0) {
      setError("Ajoutez au moins un fichier, ou passez cette étape.");
      return;
    }

    setPending(true);
    setError(null);

    const mergedErrors: string[] = [];
    let revenueMonthsImported = 0;

    for (const file of revenueFiles) {
      const fd = new FormData();
      fd.append("revenue_statement_image", file);
      const rev = await importOnboardingRevenueDocuments(fd);
      revenueMonthsImported += rev.revenueMonthsImported;
      mergedErrors.push(...rev.errors);
    }

    const importOk = revenueMonthsImported > 0 || mergedErrors.length === 0;
    setPending(false);

    if (!importOk) {
      setError(mergedErrors.join(" ") || "Import CA impossible.");
      return;
    }

    setRevenueFiles([]);
    navigateToNextOnboardingAfterRevenueStep(router);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className={uiSectionTitleSm}>Chiffre d’affaires passé</h2>
        <p className={`mt-1 ${uiMuted}`}>
          Comme dans l’<strong className="font-medium text-slate-800">assistant d’import IA</strong> : relevés mensuels,
          exports caisse ou tableaux de CA (image ou PDF). Chaque fichier est traité séparément. Les montants alimentent
          la page{" "}
          <Link href="/insights/revenue" className="font-medium text-indigo-600 underline underline-offset-2">
            CA mensuel importé
          </Link>
          .
        </p>
      </div>

      {error ? <p className={uiError}>{error}</p> : null}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <input
          type="file"
          accept=".pdf,image/*"
          multiple
          disabled={pending}
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
        <button type="submit" disabled={pending} className={uiBtnPrimaryBlock}>
          {pending ? "Import en cours…" : "Importer et terminer cette partie"}
        </button>
      </form>

      <button type="button" onClick={finishSkip} className={uiBtnSecondary}>
        Passer cette étape
      </button>
    </div>
  );
}
