"use client";

import { useRouter } from "next/navigation";
import type { Service } from "@/lib/db";
import type { ServiceImportLineWithDish } from "@/lib/serviceLines";
import { validateAndSaveServiceSales } from "./actions";
import { ServiceLineRevisionRow } from "./ServiceLineRevisionRow";
import { ServiceAddLineForm } from "./ServiceAddLineForm";

/** Une ligne affichée : soit une ligne seule, soit un groupe (même normalized_label, qty = somme). */
export type GroupedDisplayLine = {
  lineIds: string[];
  raw_label: string;
  normalized_label: string;
  qty: number;
  line_index: number;
  dish_id: string | null;
  ignored: boolean;
  dish?: { name: string } | null;
};

function groupLinesByNormalizedLabel(lines: ServiceImportLineWithDish[]): GroupedDisplayLine[] {
  const byKey = new Map<string, GroupedDisplayLine>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const key = line.normalized_label || line.raw_label || String(i);
    const existing = byKey.get(key);
    if (existing) {
      existing.lineIds.push(line.id);
      existing.qty += line.qty;
    } else {
      byKey.set(key, {
        lineIds: [line.id],
        raw_label: line.raw_label,
        normalized_label: line.normalized_label,
        qty: line.qty,
        line_index: line.line_index,
        dish_id: line.dish_id,
        ignored: line.ignored,
        dish: line.dish,
      });
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.line_index - b.line_index);
}

export function ServiceLinesRevisionBlock({
  service,
  lines,
  dishes,
  existingSalesCount,
}: {
  service: Service;
  lines: ServiceImportLineWithDish[];
  dishes: { id: string; name: string }[];
  existingSalesCount: number;
}) {
  const router = useRouter();
  const displayLines = groupLinesByNormalizedLabel(lines);

  const previewRows = lines
    .filter((l) => l.dish_id != null && !l.ignored)
    .reduce((acc, l) => {
      const id = l.dish_id!;
      const name = l.dish?.name ?? id;
      const cur = acc.get(id) ?? { dish_id: id, name, qty: 0 };
      cur.qty += l.qty;
      acc.set(id, cur);
      return acc;
    }, new Map<string, { dish_id: string; name: string; qty: number }>());
  const preview = Array.from(previewRows.values()).sort((a, b) => a.name.localeCompare(b.name, "fr"));

  async function handleValidate() {
    const result = await validateAndSaveServiceSales(service.id, service.restaurant_id);
    if (result.ok) router.refresh();
    else alert(result.error);
  }

  return (
    <>
      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-500">Lignes du ticket (révision)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="pb-2 pr-2 font-medium text-slate-600">#</th>
                <th className="pb-2 pr-2 font-medium text-slate-600">Nom brut</th>
                <th className="pb-2 pr-2 font-medium text-slate-600">Normalisé</th>
                <th className="pb-2 pr-2 font-medium text-slate-600">Qté</th>
                <th className="pb-2 pr-2 font-medium text-slate-600">Statut</th>
                <th className="pb-2 pr-2 font-medium text-slate-600">Plat associé</th>
                <th className="pb-2 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayLines.map((displayLine, idx) => (
                <ServiceLineRevisionRow
                  key={displayLine.lineIds[0] ?? idx}
                  displayLine={displayLine}
                  rowIndex={idx}
                  dishes={dishes}
                  restaurantId={service.restaurant_id}
                />
              ))}
            </tbody>
          </table>
        </div>
        <ServiceAddLineForm serviceId={service.id} restaurantId={service.restaurant_id} />
      </section>

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-500">Prévisualisation des ventes</h2>
        <p className="mb-3 text-xs text-slate-500">
          Ce qui sera enregistré après clic sur « Valider et enregistrer les ventes ». Lignes reconnues et non ignorées, regroupées par plat.
        </p>
        {preview.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune ligne à enregistrer (associez des lignes à des plats).</p>
        ) : (
          <ul className="space-y-1 text-sm text-slate-700">
            {preview.map((p) => (
              <li key={p.dish_id}>
                <strong>{p.name}</strong> : {p.qty} vendu{p.qty > 1 ? "s" : ""}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <button
            type="button"
            onClick={handleValidate}
            disabled={preview.length === 0}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Valider et enregistrer les ventes
          </button>
          {existingSalesCount > 0 && (
            <span className="ml-3 text-sm text-slate-500">
              {existingSalesCount} vente(s) déjà enregistrée(s) (le clic met à jour).
            </span>
          )}
        </div>
      </section>
    </>
  );
}
