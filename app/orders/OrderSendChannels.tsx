"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Globe, Mail, MessageCircle, MessageSquare, Phone } from "lucide-react";
import { markPurchaseOrderSentManualAction, sendPurchaseOrderEmailAction } from "./actions";
import { uiBtnPrimary, uiBtnSecondary } from "@/components/ui/premium";

export type CreateOrderResult =
  | { ok: true; data?: { orderId: string } | null }
  | { ok: false; error: string };

function normalizeWhatsappPhone(phone: string | null): string {
  let digits = phone?.replace(/[^\d]/g, "") ?? "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("0")) digits = `33${digits.slice(1)}`;
  if (digits.length === 9 && (digits.startsWith("6") || digits.startsWith("7"))) digits = `33${digits}`;
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

/**
 * Bloc « Envoyer via » réutilisable : crée la commande à la volée au 1er envoi
 * (via `createOrder`), puis expédie par le canal choisi (e-mail Resend, WhatsApp,
 * SMS) ou la marque envoyée (téléphone / portail). Gère son propre état.
 */
export function OrderSendChannels({
  restaurantId,
  supplierEmail,
  supplierPhone,
  supplierWhatsapp,
  message,
  createOrder,
  disabled = false,
  onBusyChange,
}: {
  restaurantId: string;
  supplierEmail: string | null;
  supplierPhone: string | null;
  supplierWhatsapp: string | null;
  message: string;
  createOrder: () => Promise<CreateOrderResult>;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [working, setWorkingState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const waHref = whatsappHref(supplierWhatsapp, message);
  const smsLink = smsHref(supplierPhone, message);
  const blocked = disabled || working;

  function setWorking(b: boolean) {
    setWorkingState(b);
    onBusyChange?.(b);
  }

  async function ensureOrderId(): Promise<string | null> {
    if (orderId) return orderId;
    const res = await createOrder();
    if (res.ok) {
      const id = res.data?.orderId ?? null;
      if (id) {
        setOrderId(id);
        return id;
      }
      setError("Commande créée mais identifiant manquant.");
      return null;
    }
    setError(res.error);
    return null;
  }

  async function sendEmail() {
    setError(null);
    setNotice(null);
    setWorking(true);
    const id = await ensureOrderId();
    if (id) {
      const res = await sendPurchaseOrderEmailAction({ orderId: id, restaurantId });
      if (!res.ok) setError(res.error);
      else
        setNotice(
          res.data?.alreadySent
            ? "Commande déjà envoyée par e-mail. La réception est prête dans Livraison."
            : "Commande envoyée par e-mail. La réception est prête dans Livraison."
        );
    }
    setWorking(false);
  }

  function openChannelLink(href: string | null, channel: "whatsapp" | "sms") {
    setError(null);
    setNotice(null);
    void navigator.clipboard.writeText(message).catch(() => undefined);
    if (href) window.open(href, "_blank", "noopener,noreferrer");
    setWorking(true);
    void (async () => {
      const id = await ensureOrderId();
      if (id) {
        const res = await markPurchaseOrderSentManualAction({ orderId: id, restaurantId, channel });
        if (!res.ok) setError(res.error);
        else
          setNotice(
            `${channel === "whatsapp" ? "WhatsApp" : "SMS"} ouvert, commande marquée comme envoyée. La réception est prête dans Livraison.`
          );
      }
      setWorking(false);
    })();
  }

  async function markManual(channel: "phone" | "portal") {
    setError(null);
    setNotice(null);
    setWorking(true);
    const id = await ensureOrderId();
    if (id) {
      const res = await markPurchaseOrderSentManualAction({ orderId: id, restaurantId, channel });
      if (!res.ok) setError(res.error);
      else setNotice("Commande marquée comme envoyée. La réception est prête dans Livraison.");
    }
    setWorking(false);
  }

  function copyMessage() {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Envoyer via</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={blocked || !supplierEmail}
          onClick={sendEmail}
          title={supplierEmail ? `Envoyer à ${supplierEmail}` : "Aucun e-mail fournisseur"}
          className={`${uiBtnPrimary} inline-flex items-center justify-center gap-2`}
        >
          <Mail className="h-4 w-4" aria-hidden />
          Envoyer par e-mail
        </button>
        <button
          type="button"
          disabled={blocked || !waHref}
          onClick={() => openChannelLink(waHref, "whatsapp")}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          WhatsApp
        </button>
        <button
          type="button"
          disabled={blocked || !smsLink}
          onClick={() => openChannelLink(smsLink, "sms")}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100 disabled:opacity-50"
        >
          <MessageSquare className="h-4 w-4" aria-hidden />
          SMS
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={copyMessage}
          className={`${uiBtnSecondary} inline-flex items-center justify-center gap-2`}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-emerald-600" aria-hidden />
              Copié
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" aria-hidden />
              Copier le message
            </>
          )}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={blocked}
          onClick={() => markManual("phone")}
          className={`${uiBtnSecondary} inline-flex items-center gap-1.5`}
        >
          <Phone className="h-4 w-4" aria-hidden />
          Marquer téléphone
        </button>
        <button
          type="button"
          disabled={blocked}
          onClick={() => markManual("portal")}
          className={`${uiBtnSecondary} inline-flex items-center gap-1.5`}
        >
          <Globe className="h-4 w-4" aria-hidden />
          Marquer portail
        </button>
        {orderId ? (
          <Link href={`/orders/${orderId}`} className={`${uiBtnSecondary} ml-auto`}>
            Ouvrir la commande
          </Link>
        ) : null}
      </div>

      {working ? <p className="mt-3 text-sm text-stone-500">Traitement en cours…</p> : null}
      {!supplierEmail ? (
        <p className="mt-2 text-xs text-amber-700">
          Aucun e-mail fournisseur : ajoutez-le sur la fiche fournisseur pour l’envoi direct par e-mail.
        </p>
      ) : null}
      {notice ? (
        <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-emerald-700">
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {notice}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
