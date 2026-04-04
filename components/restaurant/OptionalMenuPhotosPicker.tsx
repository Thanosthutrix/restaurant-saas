"use client";

import { uiBtnOutlineSm, uiFileInput, uiFormLabel, uiMuted } from "@/components/ui/premium";

function fileKey(f: File): string {
  return `${f.name}-${f.size}-${f.lastModified}`;
}

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
};

/**
 * Sélection multiple + entrée « appareil photo » (mobile) pour analyse de carte après création du restaurant.
 */
export function OptionalMenuPhotosPicker({ files, onChange, disabled }: Props) {
  const mergeFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const map = new Map<string, File>();
    for (const f of files) map.set(fileKey(f), f);
    for (const f of Array.from(list)) map.set(fileKey(f), f);
    onChange([...map.values()]);
  };

  const removeAt = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      <div>
        <p className={uiFormLabel}>Photo(s) de carte (optionnel)</p>
        <p className={`mt-1 ${uiMuted}`}>
          Si vous ajoutez des photos, le modèle du type d’établissement (composants stock et plats suggérés) n’est
          pas appliqué : la carte analysée le remplace. L’IA propose plats, prix TTC et ingrédients ; rien n’est
          enregistré sans votre validation.
        </p>
      </div>
      <div>
        <label className={`mb-1 block text-xs font-medium text-slate-500`}>Galerie (plusieurs fichiers)</label>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={disabled}
          onChange={(e) => {
            mergeFiles(e.target.files);
            e.target.value = "";
          }}
          className={uiFileInput}
        />
      </div>
      <div>
        <label className={`mb-1 block text-xs font-medium text-slate-500`}>Appareil photo</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={disabled}
          onChange={(e) => {
            mergeFiles(e.target.files);
            e.target.value = "";
          }}
          className={uiFileInput}
        />
      </div>
      {files.length > 0 && (
        <ul className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">
          {files.map((f, i) => (
            <li key={fileKey(f)} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate" title={f.name}>
                {f.name}
              </span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                disabled={disabled}
                className={uiBtnOutlineSm}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
