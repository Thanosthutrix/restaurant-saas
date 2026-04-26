"use client";

import type { ReactNode } from "react";
import type { DiningLineClient } from "@/app/salle/commande/diningOrderTypes";
import type { DiningPaymentMethod } from "@/lib/dining/diningPaymentMethods";
import { DINING_PAYMENT_METHODS } from "@/lib/dining/diningPaymentMethods";
import { uiBtnPrimary, uiError, uiLead } from "@/components/ui/premium";

export const PAYMENT_SHORT: Record<DiningPaymentMethod, string> = {
  card: "CB",
  cash: "Esp.",
  cheque: "Chq.",
};

export function fmtEur(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

export function discountBadge(l: DiningLineClient) {
  if (l.discountKind === "none") return null;
  if (l.discountKind === "free") return "Offert";
  if (l.discountKind === "percent" && l.discountValue != null) return `−${l.discountValue}%`;
  if (l.discountKind === "amount" && l.discountValue != null) return `−${fmtEur(l.discountValue)}`;
  return "Remise";
}

type LineRowProps = {
  line: DiningLineClient;
  pending: boolean;
  onAdjust: (lineId: string, delta: number) => void;
  onRemove: (lineId: string) => void;
  onDiscount: (line: DiningLineClient) => void;
  /** Si renseigné, affiche le bouton Prêt (cuisine). */
  onToggleLinePrepared?: (lineId: string, next: boolean) => void;
};

export function DiningOrderTicketLineRow({
  line: l,
  pending,
  onAdjust,
  onRemove,
  onDiscount,
  onToggleLinePrepared,
}: LineRowProps) {
  return (
    <li className="flex items-center gap-1.5 rounded-md border border-slate-100 bg-slate-50/90 px-1.5 py-1">
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left text-xs leading-tight text-slate-900"
        disabled={pending}
        title="Remise"
        onClick={() => onDiscount(l)}
      >
        <span className="font-medium">{l.dishName}</span>
        <span className="text-slate-500"> ×{l.qty}</span>
        <span className="ml-1 tabular-nums text-slate-700">{fmtEur(l.lineTotalTtc)}</span>
        {l.discountKind !== "none" ? (
          <span className="ml-1 text-[10px] font-semibold text-amber-800">({discountBadge(l)})</span>
        ) : null}
      </button>
      {onToggleLinePrepared ? (
        <button
          type="button"
          disabled={pending}
          title="Marquer le plat comme prêt (cuisine)"
          onClick={() => onToggleLinePrepared(l.id, !l.isPrepared)}
          className={
            l.isPrepared
              ? "shrink-0 rounded border border-emerald-300 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-emerald-900 transition hover:bg-emerald-200 disabled:opacity-50"
              : "shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold leading-none text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          }
        >
          Prêt
        </button>
      ) : null}
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          disabled={pending}
          onClick={() => onAdjust(l.id, -1)}
        >
          −
        </button>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          disabled={pending}
          onClick={() => onAdjust(l.id, 1)}
        >
          +
        </button>
        <button
          type="button"
          className="flex h-7 min-w-[1.75rem] items-center justify-center rounded border border-rose-200 bg-white px-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          disabled={pending}
          title="Retirer"
          onClick={() => onRemove(l.id)}
        >
          ×
        </button>
      </div>
    </li>
  );
}

type FooterBarProps = {
  totalTtc: number;
  paymentMethod: DiningPaymentMethod;
  onPaymentMethod: (m: DiningPaymentMethod) => void;
  pending: boolean;
  loading?: boolean;
  linesCount: number;
  onSettle: () => void;
  onCancel: () => void;
};

export function DiningOrderTicketFooterBar({
  totalTtc,
  paymentMethod,
  onPaymentMethod,
  pending,
  loading = false,
  linesCount,
  onSettle,
  onCancel,
}: FooterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-slate-100 bg-slate-50/60 px-2 py-1.5">
      <span className="text-xs font-semibold text-slate-600">Total</span>
      <span className="text-sm font-bold tabular-nums text-slate-900">{fmtEur(totalTtc)}</span>
      <span className="hidden min-[380px]:inline text-[10px] text-slate-400">|</span>
      <div className="flex flex-1 flex-wrap items-center justify-end gap-1">
        {DINING_PAYMENT_METHODS.map((m) => (
          <button
            key={m}
            type="button"
            disabled={pending}
            onClick={() => onPaymentMethod(m)}
            className={
              paymentMethod === m
                ? "rounded-md bg-indigo-600 px-2 py-0.5 text-[11px] font-semibold text-white"
                : "rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
            }
          >
            {PAYMENT_SHORT[m]}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`${uiBtnPrimary} shrink-0 px-3 py-1.5 text-xs font-semibold`}
        disabled={pending || loading || linesCount === 0 || totalTtc < 0}
        onClick={onSettle}
      >
        Encaisser
      </button>
      <button
        type="button"
        className="ml-auto text-[11px] font-medium text-rose-700 underline decoration-rose-200 underline-offset-1 hover:text-rose-900 disabled:opacity-50"
        disabled={pending}
        onClick={onCancel}
      >
        Annuler
      </button>
    </div>
  );
}

type CardProps = {
  header: ReactNode;
  error: string | null;
  linesContent: ReactNode;
  footer: ReactNode;
};

export function DiningOrderTicketCard({ header, error, linesContent, footer }: CardProps) {
  return (
    <div className="rounded-lg border border-slate-200/90 bg-white shadow-sm">
      {header}
      {error ? <p className={`${uiError} px-2 py-1 text-xs`}>{error}</p> : null}
      {linesContent}
      {footer}
    </div>
  );
}

export function DiningOrderTicketLinesScroll({ children }: { children: ReactNode }) {
  return (
    <div className="max-h-[min(18vh,160px)] overflow-y-auto px-1.5 py-1">{children}</div>
  );
}

export function DiningOrderTicketEmptyLines({ message }: { message: string }) {
  return (
    <p className={`py-2 text-center text-xs ${uiLead}`}>{message}</p>
  );
}
