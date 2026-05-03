import { getRestaurantById } from "@/lib/auth";
import { getSupplier, getSupplierInvoiceWithDeliveryNotes } from "@/lib/db";
import {
  tryClaimOrRetryIdempotentDelivery,
  tryRecordSkippedDelivery,
  updateMessageDelivery,
} from "@/lib/messaging/messagingDb";
import { sendEmailViaResend } from "@/lib/messaging/resendSend";
import {
  buildSupplierInvoiceClaimMessage,
  computeSupplierInvoiceClaimSummary,
} from "@/lib/supplier-invoice-claim-message";

export async function sendSupplierInvoiceClaimEmail(params: {
  restaurantId: string;
  invoiceId: string;
}): Promise<{ ok: true; sent: boolean; alreadySent: boolean } | { ok: false; error: string }> {
  const { restaurantId, invoiceId } = params;
  const invRes = await getSupplierInvoiceWithDeliveryNotes(invoiceId);
  if (invRes.error) return { ok: false, error: invRes.error.message };
  const invoice = invRes.data;
  if (!invoice || invoice.restaurant_id !== restaurantId) {
    return { ok: false, error: "Facture fournisseur introuvable." };
  }

  const rows = invoice.invoice_line_comparisons;
  const summary = computeSupplierInvoiceClaimSummary(rows);
  if (!summary?.unfavorable) {
    return { ok: false, error: "Aucun écart défavorable à signaler (réclamation non applicable)." };
  }

  const supplierRes = await getSupplier(invoice.supplier_id);
  if (supplierRes.error) return { ok: false, error: supplierRes.error.message };
  const supplier = supplierRes.data;
  if (!supplier || supplier.restaurant_id !== restaurantId) {
    return { ok: false, error: "Fournisseur introuvable." };
  }

  const to = supplier.email?.trim() ?? "";
  if (!to) return { ok: false, error: "Aucun e-mail renseigné sur la fiche fournisseur." };

  const rest = await getRestaurantById(restaurantId);
  const restaurantName = rest?.name?.trim() || "Restaurant";
  const fromDisplayName = rest?.messaging_sender_display_name?.trim() || restaurantName;

  const text = buildSupplierInvoiceClaimMessage({
    invoiceNumber: invoice.invoice_number,
    invoiceDate: invoice.invoice_date,
    restaurantName,
    rows,
  });
  if (!text) {
    return { ok: false, error: "Impossible de générer le message de réclamation." };
  }

  const subject = `Réclamation facture ${supplier.name}${invoice.invoice_number ? ` — ${invoice.invoice_number}` : ""}`;
  const idempotencyKey = `supplier_invoice_claim:${invoiceId}:email`;

  if (!process.env.RESEND_API_KEY?.trim()) {
    try {
      await tryRecordSkippedDelivery({
        restaurantId,
        channel: "email",
        category: "supplier_invoice_claim",
        action: "send_supplier",
        toAddress: to,
        subject,
        idempotencyKey,
        errorDetail: "RESEND_API_KEY non configurée (réclamation facture non envoyée).",
      });
    } catch {
      // optionnel
    }
    return {
      ok: false,
      error:
        "E-mail non configuré : RESEND_API_KEY est absente côté serveur. Vérifiez `.env.local` puis redémarrez `npm run dev`.",
    };
  }

  let deliveryId: string;
  try {
    const claim = await tryClaimOrRetryIdempotentDelivery({
      restaurantId,
      channel: "email",
      category: "supplier_invoice_claim",
      action: "send_supplier",
      toAddress: to,
      subject,
      idempotencyKey,
    });
    if ("skip" in claim) {
      return { ok: true, sent: false, alreadySent: true };
    }
    deliveryId = claim.id;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Journal d’envoi indisponible." };
  }

  try {
    const { id: providerId } = await sendEmailViaResend({ to, subject, text, fromDisplayName });
    await updateMessageDelivery(deliveryId, {
      status: "sent",
      provider: "resend",
      provider_message_id: providerId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      await updateMessageDelivery(deliveryId, {
        status: "failed",
        provider: "resend",
        error_detail: msg,
      });
    } catch (err) {
      console.error("supplier invoice claim email: update failed delivery", err);
    }
    return { ok: false, error: msg };
  }

  return { ok: true, sent: true, alreadySent: false };
}
