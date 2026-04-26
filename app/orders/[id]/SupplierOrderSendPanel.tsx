"use client";

import { useMemo, useState, useTransition } from "react";
import type { PreferredOrderMethod } from "@/lib/db";
import { markPurchaseOrderSentManualAction, sendPurchaseOrderEmailAction } from "../actions";

type Props = {
  orderId: string;
  restaurantId: string;
  supplierName: string;
  supplierEmail: string | null;
  supplierPhone: string | null;
  supplierWhatsapp: string | null;
  preferredOrderMethod: PreferredOrderMethod;
  message: string;
  sentAt: string | null;
  sentToEmail: string | null;
  sentChannel: "email" | "whatsapp" | "sms" | "phone" | "portal" | null;
};

const METHOD_LABELS: Record<PreferredOrderMethod, string> = {
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  PHONE: "Téléphone",
  PORTAL: "Portail fournisseur",
};

const CHANNEL_LABELS: Record<NonNullable<Props["sentChannel"]>, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  sms: "SMS",
  phone: "Téléphone",
  portal: "Portail fournisseur",
};

function normalizeWhatsappPhone(phone: string | null): string {
  let digits = phone?.replace(/[^\d]/g, "") ?? "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("0")) digits = `33${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith("6")) digits = `33${digits}`;
  if (digits.length === 9 && digits.startsWith("7")) digits = `33${digits}`;
  return digits;
}

function whatsappHref(phone: string | null, message: string): string | null {
  const digits = normalizeWhatsappPhone(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function smsHref(phone: string | null, message: string): string | null {
  const digits = normalizeWhatsappPhone(phone);
  if (!digits) return null;
  return `sms:+${digits}?&body=${encodeURIComponent(message)}`;
}

export function SupplierOrderSendPanel({
  orderId,
  restaurantId,
  supplierName,
  supplierEmail,
  supplierPhone,
  supplierWhatsapp,
  preferredOrderMethod,
  message,
  sentAt,
  sentToEmail,
  sentChannel,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const waHref = useMemo(() => whatsappHref(supplierWhatsapp, message), [supplierWhatsapp, message]);
  const smsLink = useMemo(() => smsHref(supplierPhone, message), [supplierPhone, message]);

  const copyMessage = async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(message);
      setNotice("Message copié.");
    } catch {
      setError("Impossible de copier automatiquement. Sélectionnez le texte du message ci-dessous.");
    }
  };

  const sendEmail = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await sendPurchaseOrderEmailAction({ orderId, restaurantId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotice(
        res.data?.alreadySent
          ? "Commande déjà envoyée par e-mail. La réception est prête dans Livraison."
          : "Commande envoyée par e-mail. La réception est prête dans Livraison."
      );
    });
  };

  const openWhatsapp = () => {
    setError(null);
    setNotice(null);
    void navigator.clipboard.writeText(message).catch(() => undefined);
    if (waHref) window.open(waHref, "_blank", "noopener,noreferrer");
    startTransition(async () => {
      const res = await markPurchaseOrderSentManualAction({ orderId, restaurantId, channel: "whatsapp" });
      if (!res.ok) setError(res.error);
      else setNotice("WhatsApp ouvert, commande marquée comme envoyée. La réception est prête dans Livraison.");
    });
  };

  const openSms = () => {
    setError(null);
    setNotice(null);
    void navigator.clipboard.writeText(message).catch(() => undefined);
    if (smsLink) window.open(smsLink, "_blank", "noopener,noreferrer");
    startTransition(async () => {
      const res = await markPurchaseOrderSentManualAction({ orderId, restaurantId, channel: "sms" });
      if (!res.ok) setError(res.error);
      else setNotice("SMS ouvert, commande marquée comme envoyée. La réception est prête dans Livraison.");
    });
  };

  const markManual = (channel: "phone" | "portal") => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await markPurchaseOrderSentManualAction({ orderId, restaurantId, channel });
      if (!res.ok) setError(res.error);
      else setNotice("Commande marquée comme envoyée. La réception est prête dans Livraison.");
    });
  };

  const sentDate = sentAt
    ? new Date(sentAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-slate-900">Envoi fournisseur</h2>
          <p className="mt-1 text-xs text-slate-500">
            Méthode préférée : <span className="font-semibold text-slate-700">{METHOD_LABELS[preferredOrderMethod]}</span>
          </p>
          {sentDate ? (
            <p className="mt-1 text-xs font-medium text-emerald-700">
              Envoyée le {sentDate}
              {sentChannel ? ` via ${CHANNEL_LABELS[sentChannel]}` : ""}
              {sentToEmail ? ` à ${sentToEmail}` : ""}.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={copyMessage}
          className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Copier le message
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !supplierEmail}
          onClick={sendEmail}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          title={supplierEmail ? `Envoyer à ${supplierEmail}` : "Renseignez l’e-mail sur la fiche fournisseur"}
        >
          {pending ? "Envoi…" : "Envoyer par e-mail"}
        </button>
        <button
          type="button"
          disabled={pending || !waHref}
          onClick={openWhatsapp}
          className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
          title={waHref ? `Ouvrir WhatsApp pour ${supplierName}` : "Renseignez un WhatsApp fournisseur"}
        >
          Ouvrir WhatsApp
        </button>
        <button
          type="button"
          disabled={pending || !smsLink}
          onClick={openSms}
          className="rounded border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-900 hover:bg-sky-100 disabled:opacity-50"
          title={smsLink ? `Ouvrir SMS pour ${supplierName}` : "Renseignez un téléphone fournisseur"}
        >
          Ouvrir SMS
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => markManual("phone")}
          className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Marquer téléphone
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => markManual("portal")}
          className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Marquer portail
        </button>
      </div>

      {!supplierEmail ? (
        <p className="mt-2 text-xs text-amber-700">
          Aucun e-mail fournisseur : ajoutez-le sur la fiche fournisseur pour l’envoi direct Resend.
        </p>
      ) : null}
      {!waHref && preferredOrderMethod === "WHATSAPP" ? (
        <p className="mt-2 text-xs text-amber-700">
          Méthode WhatsApp choisie, mais aucun numéro WhatsApp n’est renseigné.
        </p>
      ) : null}
      {!smsLink && supplierPhone == null ? (
        <p className="mt-2 text-xs text-amber-700">
          Aucun téléphone fournisseur : renseignez-le pour ouvrir un SMS prérempli.
        </p>
      ) : null}
      {notice ? <p className="mt-2 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
