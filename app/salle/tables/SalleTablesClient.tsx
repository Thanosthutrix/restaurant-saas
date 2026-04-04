"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DiningTableRow } from "@/lib/dining/diningDb";
import { addDiningTable, setDiningTableActive, updateDiningTableLabel } from "./actions";
import {
  uiBtnOutlineSm,
  uiBtnPrimary,
  uiBtnPrimarySm,
  uiCard,
  uiError,
  uiInput,
  uiLabel,
  uiListRow,
  uiMuted,
} from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  tables: DiningTableRow[];
};

export function SalleTablesClient({ restaurantId, tables }: Props) {
  const router = useRouter();
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = () => {
    router.refresh();
  };

  const handleAdd = () => {
    setError(null);
    startTransition(async () => {
      const res = await addDiningTable({ restaurantId, label: newLabel });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNewLabel("");
      refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className={`${uiCard} space-y-3`}>
        <p className={uiLabel}>Nouvelle table</p>
        <div className="flex flex-wrap gap-2">
          <input
            className={`${uiInput} min-w-[12rem] flex-1`}
            placeholder="ex. 1, T12, Terrasse 3"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            disabled={pending}
          />
          <button type="button" className={uiBtnPrimary} disabled={pending} onClick={handleAdd}>
            Ajouter
          </button>
        </div>
        {error ? <p className={uiError}>{error}</p> : null}
      </div>

      <ul className="space-y-2">
        {tables.length === 0 ? (
          <li className={uiMuted}>Aucune table pour l’instant.</li>
        ) : (
          tables.map((t) => (
            <TableRowEditor
              key={t.id}
              restaurantId={restaurantId}
              table={t}
              onUpdated={refresh}
            />
          ))
        )}
      </ul>
    </div>
  );
}

function TableRowEditor({
  restaurantId,
  table,
  onUpdated,
}: {
  restaurantId: string;
  table: DiningTableRow;
  onUpdated: () => void;
}) {
  const [label, setLabel] = useState(table.label);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const saveLabel = () => {
    setErr(null);
    startTransition(async () => {
      const res = await updateDiningTableLabel({
        restaurantId,
        tableId: table.id,
        label,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      onUpdated();
    });
  };

  const toggle = () => {
    setErr(null);
    startTransition(async () => {
      const res = await setDiningTableActive({
        restaurantId,
        tableId: table.id,
        isActive: !table.is_active,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      onUpdated();
    });
  };

  return (
    <li className={uiListRow}>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${uiInput} max-w-[14rem]`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={pending}
          />
          <button type="button" className={uiBtnPrimarySm} disabled={pending} onClick={saveLabel}>
            Enregistrer
          </button>
        </div>
        {err ? <p className={`${uiError} text-xs`}>{err}</p> : null}
        <p className={uiMuted}>
          {table.is_active ? "Visible sur le plan salle" : "Masquée (inactive)"}
        </p>
      </div>
      <button type="button" className={uiBtnOutlineSm} disabled={pending} onClick={toggle}>
        {table.is_active ? "Désactiver" : "Réactiver"}
      </button>
    </li>
  );
}
