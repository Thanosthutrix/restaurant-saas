import { Resend } from "resend";

/** Construit l’en-tête From Resend : `Nom <adresse>`, avec guillemets si le nom contient des caractères spéciaux. */
export function buildResendFromHeader(address: string, displayName: string | null | undefined): string {
  const addr = address.trim();
  const raw = displayName?.trim();
  if (!raw) {
    return addr;
  }
  const escaped = raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}" <${addr}>`;
}

/**
 * Envoie un e-mail texte via Resend (clé `RESEND_API_KEY`, adresse d’envoi `MESSAGING_FROM_EMAIL`).
 * `fromDisplayName` : nom vu par le destinataire (souvent paramétré par restaurant sur la fiche établissement).
 */
export async function sendEmailViaResend(params: {
  to: string;
  subject: string;
  text: string;
  fromDisplayName?: string | null;
}): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error("RESEND_API_KEY manquant.");
  }
  const fromAddr = process.env.MESSAGING_FROM_EMAIL?.trim() || "onboarding@resend.dev";
  const from = buildResendFromHeader(fromAddr, params.fromDisplayName);
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    text: params.text,
  });
  if (error) {
    throw new Error(error.message);
  }
  if (!data?.id) {
    throw new Error("Réponse Resend sans id de message.");
  }
  return { id: data.id };
}
