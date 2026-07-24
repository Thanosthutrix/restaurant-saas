"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Armchair, Eye, EyeOff, Plus } from "lucide-react";
import type { DiningTableRow } from "@/lib/dining/diningDb";
import { addDiningTable, setDiningTableActive, updateDiningTableLabel } from "./actions";
import {
  uiBadgeEmerald,
  uiBadgeSlate,
  uiBtnPrimarySm,
  uiCard,
  uiError,
  uiInput,
  uiSectionTitleSm,
} from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  tables: DiningTableRow[];
  stats: { total: number; active: number; inactive: number };
};

export function SalleTablesClient({ restaurantId, tables, stats }: Props) {
  const router = useRouter();
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = () => router.refresh();

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
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatPill label="Total" value={stats.total} />
        <StatPill label="Actives" value={stats.active} tone="emerald" />
        <StatPill label="Masquées" value={stats.inactive} tone="muted" />
      </div>

      <section className={`${uiCard} space-y-3`}>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-copper-50 text-copper-800 ring-1 ring-copper-100/90">
            <Plus className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className={uiSectionTitleSm}>Nouvelle table</h2>
            <p className="text-xs text-stone-500">Libellé court — visible immédiatement en salle si active.</p>
          </div>
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newLabel.trim() || pending) return;
            handleAdd();
          }}
        >
          <input
            className={`${uiInput} min-w-0 flex-1`}
            placeholder="Ex. T.1, Terrasse 3, Bar"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            disabled={pending}
            autoComplete="off"
          />
          <button
            type="submit"
            className={`${uiBtnPrimarySm} inline-flex min-h-10 items-center justify-center gap-1.5 px-4 sm:shrink-0`}
            disabled={pending || !newLabel.trim()}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Ajouter
          </button>
        </form>
        {error ? <p className={uiError}>{error}</p> : null}
      </section>

      {tables.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <h2 className={uiSectionTitleSm}>Vos tables</h2>
            <p className="text-xs text-stone-500">{stats.total} entrée{stats.total > 1 ? "s" : ""}</p>
          </div>
          <ul className="space-y-2">
            {tables.map((table) => (
              <TableRowEditor key={table.id} restaurantId={restaurantId} table={table} onUpdated={refresh} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function StatPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "emerald" | "muted";
}) {
  const valueCls =
    tone === "emerald" ? "text-emerald-800" : tone === "muted" ? "text-stone-500" : "text-stone-900";
  return (
    <div className="rounded-xl border border-stone-200/70 bg-white px-3 py-2.5 text-center shadow-sm">
      <p className={`text-xl font-semibold tabular-nums leading-none ${valueCls}`}>{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</p>
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

  const isDirty = useMemo(() => label.trim() !== table.label.trim(), [label, table.label]);

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

  const toggleActive = () => {
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
    <li
      className={`rounded-2xl border border-stone-200/70 bg-white p-3 shadow-sm transition hover:border-copper-200/80 hover:shadow-md ${
        table.is_active ? "" : "opacity-[0.88]"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${
              table.is_active
                ? "bg-copper-50 text-copper-800 ring-copper-100/90"
                : "bg-stone-100 text-stone-400 ring-stone-200/80"
            }`}
          >
            <Armchair className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${uiInput} min-w-0 flex-1 py-1.5 text-sm`}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={pending}
                aria-label={`Libellé de ${table.label}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isDirty) {
                    e.preventDefault();
                    saveLabel();
                  }
                }}
              />
              {isDirty ? (
                <button
                  type="button"
                  className={uiBtnPrimarySm}
                  disabled={pending || !label.trim()}
                  onClick={saveLabel}
                >
                  Enregistrer
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {table.is_active ? (
                <span className={uiBadgeEmerald}>Visible en salle</span>
              ) : (
                <span className={uiBadgeSlate}>Masquée</span>
              )}
              {err ? <span className="text-xs font-medium text-rose-700">{err}</span> : null}
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={toggleActive}
          aria-pressed={table.is_active}
          className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-50 sm:min-w-[7.5rem] ${
            table.is_active
              ? "border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300 hover:bg-stone-100"
              : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
          }`}
        >
          {table.is_active ? (
            <>
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
              Masquer
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" aria-hidden />
              Activer
            </>
          )}
        </button>
      </div>
    </li>
  );
}
