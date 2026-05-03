"use client";

import { useMemo, useState, useTransition } from "react";
import type { InvoiceLineComparison } from "@/lib/invoice-reconciliation";
import {
  buildSupplierInvoiceClaimMessage,
  computeSupplierInvoiceClaimSummary,
  formatClaimEur,
} from "@/lib/supplier-invoice-claim-message";
import { sendSupplierInvoiceClaimEmailAction } from "./actions";

type Props = {
  invoiceId: string;
  restaurantId: string;
  restaurantName: string;
  supplierName: string;
  supplierEmail: string | null;
  supplierPhone: string | null;
  supplierWhatsapp: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  rows: InvoiceLineComparison[];
  /** Détail « quelles lignes / pourquoi », affiché dans l’encadré rose ou un encart ambre */
  lineIssueDetails: string[];
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

export function InvoiceClaimActionsPanel({
  invoiceId,
  restaurantId,
  restaurantName,
  supplierName,
  supplierEmail,
  supplierPhone,
  supplierWhatsapp,
  invoiceNumber,
  invoiceDate,
  rows,
  lineIssueDetails,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => computeSupplierInvoiceClaimSummary(rows), [rows]);

  const messageText = useMemo(() => {
    if (!summary?.unfavorable) return "";
    return (
      buildSupplierInvoiceClaimMessage({
        invoiceNumber,
        invoiceDate,
        restaurantName,
        rows,
      }) ?? ""
    );
  }, [summary?.unfavorable, invoiceNumber, invoiceDate, restaurantName, rows]);

  const waHref = useMemo(() => whatsappHref(supplierWhatsapp, messageText), [supplierWhatsapp, messageText]);
  const smsLink = useMemo(() => smsHref(supplierPhone, messageText), [supplierPhone, messageText]);

  const copyMessage = async () => {
    if (!messageText) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setNotice("Message copié.");
    } catch {
      setError("Impossible de copier automatiquement. Utilisez « Copier » du navigateur.");
    }
  };

  const sendEmail = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await sendSupplierInvoiceClaimEmailAction({ invoiceId, restaurantId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotice(
        res.data.alreadySent
          ? "Cette réclamation a déjà été envoyée par e-mail (envoi enregistré)."
          : "Réclamation envoyée par e-mail au fournisseur (Resend)."
      );
    });
  };

  const openWhatsapp = () => {
    setError(null);
    setNotice(null);
    if (!waHref) return;
    void navigator.clipboard.writeText(messageText).catch(() => undefined);
    window.open(waHref, "_blank", "noopener,noreferrer");
    setNotice("WhatsApp ouvert avec le message dans le presse-papiers.");
  };

  const openSms = () => {
    setError(null);
    setNotice(null);
    if (!smsLink) return;
    void navigator.clipboard.writeText(messageText).catch(() => undefined);
    window.open(smsLink, "_blank", "noopener,noreferrer");
    setNotice("Application SMS ouverte avec le message copié.");
  };

  const detailBlock =
    lineIssueDetails.length > 0 ? (
      <>
        <p className="mt-3 text-xs font-semibold">Détail par ligne</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-snug">
          {lineIssueDetails.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs opacity-90">
          Corrigez produit, quantités ou prix sur le BL concerné ; relancez l’analyse facture si la lecture est
          incorrecte.
        </p>
      </>
    ) : null;

  if (!summary) {
    return (
      <>
        {lineIssueDetails.length > 0 ? (
          <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {detailBlock}
          </div>
        ) : null}
        <div className="mb-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Montant réel à payer non calculable : complétez les totaux des lignes facture et les prix/quantités BL.
        </div>
      </>
    );
  }

  const wrapRoseDetail =
    summary.unfavorable && detailBlock ? (
      <div className="mt-3 border-t border-rose-300/60 pt-3 text-rose-950">{detailBlock}</div>
    ) : null;

  const wrapOtherDetail =
    !summary.unfavorable && lineIssueDetails.length > 0 ? (
      <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        <p className="text-xs font-semibold">Points à vérifier (ligne par ligne)</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-snug">
          {lineIssueDetails.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-amber-900/90">
          Corrigez produit, quantités ou prix sur le BL concerné ; relancez l’analyse facture si la lecture est
          incorrecte.
        </p>
      </div>
    ) : null;

  return (
    <>
      <div
        className={`mb-3 rounded border px-3 py-3 text-sm ${
          summary.unfavorable
            ? "border-rose-200 bg-rose-50 text-rose-950"
            : "border-emerald-200 bg-emerald-50 text-emerald-950"
        }`}
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">
              {summary.unfavorable
                ? `Vous allez payer ${formatClaimEur(Math.abs(summary.delta))} de plus que ce que vous avez reçu.`
                : summary.favorable
                  ? `Erreur en faveur du restaurateur : la facture est inférieure de ${formatClaimEur(Math.abs(summary.delta))} au reçu.`
                  : "Facture cohérente avec les BL reçus."}
            </p>
            <p className="mt-1">
              Montant facturé contrôlé : <strong>{formatClaimEur(summary.invoiceTotal)}</strong>. Montant réel
              cohérent avec les BL reçus : <strong>{formatClaimEur(summary.receivedTotal)}</strong>.
            </p>
          </div>
          {summary.unfavorable && messageText ? (
            <button
              type="button"
              onClick={() => void copyMessage()}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {copied ? "Copié" : "Copier le message"}
            </button>
          ) : null}
        </div>

        {summary.unfavorable ? (
          <>
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
            </div>
            {!supplierEmail ? (
              <p className="mt-2 text-xs text-amber-700">
                Aucun e-mail fournisseur : ajoutez-le sur la fiche fournisseur pour l’envoi direct Resend.
              </p>
            ) : null}
            {!waHref && supplierWhatsapp == null ? (
              <p className="mt-2 text-xs text-amber-700">
                Renseignez un numéro WhatsApp fournisseur pour ouvrir WhatsApp avec le message prérempli.
              </p>
            ) : null}
            {!smsLink && supplierPhone == null ? (
              <p className="mt-2 text-xs text-amber-700">
                Renseignez un téléphone fournisseur pour ouvrir un SMS prérempli.
              </p>
            ) : null}
            {wrapRoseDetail}
          </>
        ) : (
          wrapRoseDetail
        )}
        {notice ? <p className="mt-2 text-sm text-emerald-700">{notice}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>
      {wrapOtherDetail}
    </>
  );
}
