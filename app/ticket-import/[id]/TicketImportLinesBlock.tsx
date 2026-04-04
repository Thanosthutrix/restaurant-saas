"use client";

import { useRouter } from "next/navigation";
import type { TicketImport, TicketImportLineWithDish } from "@/lib/sales";
import type { Dish } from "@/lib/db";
import { syncSalesForTicketImport } from "@/app/sales/actions";
import { LineRevisionRow } from "./LineRevisionRow";
import { AddLineForm } from "./AddLineForm";

export function TicketImportLinesBlock({
  ticketImport,
  lines,
  dishes,
  existingSalesCount,
}: {
  ticketImport: TicketImport;
  lines: TicketImportLineWithDish[];
  dishes: Dish[];
  existingSalesCount: number;
}) {
  const router = useRouter();

  // Prévisualisation : lignes avec plat et non ignorées, regroupées par plat
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
    const result = await syncSalesForTicketImport(ticketImport.id, ticketImport.restaurant_id);
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
              {lines.map((line) => (
                <LineRevisionRow
                  key={line.id}
                  line={line}
                  dishes={dishes}
                  restaurantId={ticketImport.restaurant_id}
                />
              ))}
            </tbody>
          </table>
        </div>
        <AddLineForm ticketImportId={ticketImport.id} restaurantId={ticketImport.restaurant_id} />
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
              {existingSalesCount} vente(s) déjà enregistrée(s) pour ce ticket (le clic met à jour).
            </span>
          )}
        </div>
      </section>
    </>
  );
}
