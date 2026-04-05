import Link from "next/link";
import type { InventoryItemWithCalculatedStock } from "@/lib/db";
import { uiListRow } from "@/components/ui/premium";

const QTY_EPS = 1e-5;

const TYPE_DOT: Record<
  string,
  { dotClass: string; label: string }
> = {
  ingredient: { dotClass: "bg-amber-500", label: "Matière première" },
  prep: { dotClass: "bg-indigo-500", label: "Préparation" },
  resale: { dotClass: "bg-emerald-500", label: "Revente" },
};

function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n - Math.round(n)) < QTY_EPS) return String(Math.round(n));
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 4 });
}

type BarProps = {
  stock: number;
  minQty: number | null;
  targetQty: number | null;
};

/**
 * Jauge min → cible : sous le min en rose, entre min et cible en ambre, au‑delà de la cible en vert.
 * Sans seuil ni cible (ni cible dérivée), pas de barre.
 */
function StockLevelBar({ stock, minQty, targetQty }: BarProps) {
  const minN = minQty != null && Number.isFinite(minQty) && minQty > 0 ? minQty : null;
  const targetN =
    targetQty != null && Number.isFinite(targetQty) && targetQty > 0
      ? targetQty
      : minN != null
        ? minN * 2
        : null;

  if (minN == null && targetN == null) return null;

  const rangeMax = Math.max(minN ?? 0, targetN ?? 0, stock, 1e-9);
  const fillPct = Math.min(100, (stock / rangeMax) * 100);
  const minPct = minN != null ? Math.min(100, (minN / rangeMax) * 100) : null;
  const targetPct = targetN != null ? Math.min(100, (targetN / rangeMax) * 100) : null;

  let fillClass = "bg-emerald-500";
  if (minN != null && stock < minN - QTY_EPS) fillClass = "bg-rose-500";
  else if (targetN != null && stock < targetN - QTY_EPS) fillClass = "bg-amber-400";

  return (
    <div
      className="relative h-2 w-full min-w-[5.5rem] max-w-[7.5rem] shrink-0 overflow-hidden rounded-full bg-slate-200/90"
      title={
        minN != null && targetN != null
          ? `Stock ${formatQty(stock)} — seuil min ${formatQty(minN)}, cible ${formatQty(targetN)}`
          : minN != null
            ? `Stock ${formatQty(stock)} — seuil min ${formatQty(minN)}`
            : `Stock ${formatQty(stock)} — cible ${formatQty(targetN!)}`
      }
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${fillClass}`}
        style={{ width: `${fillPct}%` }}
      />
      {minPct != null && minPct > 0 ? (
        <span
          className="pointer-events-auto absolute top-0 z-10 h-full w-px -translate-x-px bg-slate-700/70"
          style={{ left: `${minPct}%` }}
          title={`Seuil minimum : ${formatQty(minN!)}`}
        />
      ) : null}
      {targetPct != null && targetPct > 0 ? (
        <span
          className="pointer-events-auto absolute top-0 z-10 h-full w-px bg-slate-900/35"
          style={
            targetPct >= 99.5
              ? { right: 0 }
              : { left: `${targetPct}%`, transform: "translateX(-1px)" }
          }
          title={`Stock cible : ${formatQty(targetN!)}`}
        />
      ) : null}
    </div>
  );
}

export function InventoryItemRow({ item }: { item: InventoryItemWithCalculatedStock }) {
  const sheet = item.current_stock_qty ?? 0;
  const stock = item.stock_qty_from_movements ?? 0;
  const mismatch = Math.abs(sheet - stock) > QTY_EPS;
  const minRaw = item.min_stock_qty;
  const minN =
    minRaw != null && typeof minRaw === "number" && Number.isFinite(minRaw) && minRaw > 0
      ? minRaw
      : null;
  const targetRaw = item.target_stock_qty;
  const targetN =
    targetRaw != null && typeof targetRaw === "number" && Number.isFinite(targetRaw) && targetRaw > 0
      ? targetRaw
      : null;

  const typeInfo = TYPE_DOT[item.item_type] ?? {
    dotClass: "bg-slate-400",
    label: item.item_type,
  };

  const qtyTitle = mismatch
    ? `Stock (mouvements) : ${formatQty(stock)} — fiche : ${formatQty(sheet)} (écart)`
    : undefined;

  return (
    <li>
      <Link href={`/inventory/${item.id}`} className={`${uiListRow} items-center gap-3`}>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white ${typeInfo.dotClass}`}
            title={typeInfo.label}
            aria-label={typeInfo.label}
            role="img"
          />
          <span className="truncate font-semibold text-slate-900">{item.name}</span>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          <StockLevelBar stock={stock} minQty={minN} targetQty={targetN} />
          <span
            className={`whitespace-nowrap text-sm tabular-nums ${mismatch ? "text-amber-800" : "text-slate-700"}`}
            title={qtyTitle}
          >
            {formatQty(stock)}
            <span className="ml-1 text-slate-500">{item.unit}</span>
          </span>
        </div>
      </Link>
    </li>
  );
}

