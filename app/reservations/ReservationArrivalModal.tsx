"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { seatReservationAndOpenTicketAction } from "./actions";
import { uiError, uiInput } from "@/components/ui/premium";
import type { RestaurantReservationRow } from "@/lib/reservations/types";
import type { DiningTableRow } from "@/lib/dining/diningDb";

type Row = RestaurantReservationRow & { customerDisplayName: string | null };

type Props = {
  restaurantId: string;
  ymd: string;
  reservation: Row | null;
  tables: DiningTableRow[];
  onClose: () => void;
};

function guestName(r: Row) {
  if (r.customer_id && r.customerDisplayName) return r.customerDisplayName;
  return r.contact_name ?? "—";
}

function timeFr(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReservationArrivalModal({ restaurantId, ymd, reservation, tables, onClose }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tableId, setTableId] = useState("");
  const [showTableChoice, setShowTableChoice] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!reservation) return null;
  const resa = reservation;

  const name = guestName(resa);
  const canQuickOpen = resa.status === "seated" && resa.dining_order_id != null;
  const needTableFirst =
    resa.status === "pending" ||
    resa.status === "confirmed" ||
    (resa.status === "seated" && !resa.dining_order_id) ||
    showTableChoice;

  function goToOrder(id: string) {
    onClose();
    router.push(`/salle/commande/${id}`);
  }

  function onOpenExistingTicket() {
    setErr(null);
    start(async () => {
      const r = await seatReservationAndOpenTicketAction({
        restaurantId,
        reservationId: resa.id,
        diningTableId: null,
      });
      if (!r.ok) {
        setErr(r.error);
        setShowTableChoice(true);
        return;
      }
      if (r.data) goToOrder(r.data.orderId);
    });
  }

  function onSeatWithTable() {
    setErr(null);
    const tid = tableId.trim();
    if (!tid) {
      setErr("Indiquez une table.");
      return;
    }
    start(async () => {
      const r = await seatReservationAndOpenTicketAction({
        restaurantId,
        reservationId: resa.id,
        diningTableId: tid,
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      if (r.data) goToOrder(r.data.orderId);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arrival-title"
      onClick={(e) => e.target === e.currentTarget && !pending && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <h2 id="arrival-title" className="text-lg font-bold text-slate-900">
          Arrivée &amp; ticket
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          <span className="font-semibold text-slate-800">{name}</span>
          <span className="text-slate-400"> · </span>
          {timeFr(resa.starts_at)} – {timeFr(resa.ends_at)} · {resa.party_size} couv.
        </p>
        {resa.dining_table_id ? (
          <p className="mt-1 text-xs text-slate-600">
            Table notée :{" "}
            <span className="font-medium text-slate-800">
              {tables.find((t) => t.id === resa.dining_table_id)?.label ?? "—"}
            </span>
          </p>
        ) : null}
        {resa.notes ? (
          <p className="mt-2 line-clamp-3 rounded-lg bg-amber-50/80 px-2 py-1.5 text-xs text-amber-950">
            {resa.notes}
          </p>
        ) : null}

        {err ? <p className={`${uiError} mt-3`}>{err}</p> : null}

        {tables.length === 0 ? (
          <p className="mt-3 text-sm text-amber-800">
            Aucune table en salle. Configurez d’abord le plan de salle (tables actives) pour associer le ticket.
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {canQuickOpen && !showTableChoice ? (
            <button
              type="button"
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
              disabled={pending}
              onClick={onOpenExistingTicket}
            >
              Ouvrir le ticket salle
            </button>
          ) : null}

          {canQuickOpen && !showTableChoice ? (
            <button
              type="button"
              className="w-full text-sm text-slate-600 underline disabled:opacity-50"
              disabled={pending}
              onClick={() => setShowTableChoice(true)}
            >
              Nouveau ticket / autre table
            </button>
          ) : null}

          {needTableFirst && tables.length > 0 ? (
            <div>
              <label className="block text-xs font-medium text-slate-600">
                {resa.status === "seated" && resa.dining_order_id
                  ? "Table pour le nouveau ticket"
                  : "Table d’accueil"}
              </label>
              <select
                className={`${uiInput} mt-1 w-full py-2 text-sm`}
                value={tableId}
                disabled={pending}
                onChange={(e) => setTableId(e.target.value)}
              >
                <option value="">— Choisir —</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {needTableFirst && tables.length > 0 ? (
            <button
              type="button"
              className="w-full rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-900 hover:bg-indigo-100 disabled:opacity-60"
              disabled={pending}
              onClick={onSeatWithTable}
            >
              {resa.status === "pending" || resa.status === "confirmed"
                ? "Enregistrer l’arrivée et ouvrir le ticket"
                : "Ouvrir le ticket sur cette table"}
            </button>
          ) : null}
        </div>

        {resa.customer_id ? (
          <p className="mt-3 text-xs text-slate-500">
            Fiche client : la commande sera liée au dossier pour l’historique et les habitudes.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm">
          <Link
            href={`/reservations/${resa.id}/modifier?date=${encodeURIComponent(ymd)}`}
            className="text-indigo-600 hover:underline"
            onClick={onClose}
          >
            Modifier la réservation
          </Link>
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100"
            disabled={pending}
            onClick={onClose}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
