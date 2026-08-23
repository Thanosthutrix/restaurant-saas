import type { AdminEmailTemplateId } from "@/lib/admin/supportTypes";
import { formatBillingOfferDetail, getAppBillingBaseUrl } from "@/lib/billing/config";

type BuildParams = {
  contactName: string;
  restaurantName: string;
  ownerEmail: string;
  appUrl?: string;
};

export function buildAdminSupportEmail(
  templateId: AdminEmailTemplateId,
  params: BuildParams
): { subject: string; text: string } {
  const appUrl = params.appUrl ?? getAppBillingBaseUrl();
  const name = params.contactName.trim() || "Bonjour";
  const restaurant = params.restaurantName.trim() || "votre établissement";

  switch (templateId) {
    case "follow_up":
      return {
        subject: "Comment se passe votre utilisation d'Ubion ?",
        text: [
          `Bonjour ${name},`,
          "",
          `J'espère que ${restaurant} avance bien avec Ubion.`,
          "",
          "Avez-vous des questions sur la facturation, les réservations, la salle ou les achats ?",
          "Je suis disponible pour un échange rapide si besoin.",
          "",
          "À bientôt,",
          "Medhi — Ubion",
        ].join("\n"),
      };
    case "onboarding_checkin":
      return {
        subject: "Besoin d'aide pour configurer Ubion ?",
        text: [
          `Bonjour ${name},`,
          "",
          `Je voulais m'assurer que la mise en route de ${restaurant} sur Ubion se passe bien.`,
          "",
          "Les étapes les plus utiles au départ :",
          "• Compléter la fiche établissement",
          "• Importer ou saisir vos fournisseurs",
          "• Configurer les réservations en ligne",
          "",
          `Si vous préférez, répondez à cet email et on fait le point ensemble.`,
          "",
          "Medhi — Ubion",
        ].join("\n"),
      };
    case "trial_expiring":
      return {
        subject: "Votre essai Ubion se termine bientôt",
        text: [
          `Bonjour ${name},`,
          "",
          `Votre essai Ubion pour ${restaurant} arrive bientôt à son terme.`,
          "",
          `Pour continuer sans interruption, vous pouvez activer Ubion Pro (${formatBillingOfferDetail()}) :`,
          `${appUrl}/settings/billing`,
          "",
          "Des questions ? Répondez directement à cet email.",
          "",
          "Medhi — Ubion",
        ].join("\n"),
      };
    case "payment_help":
      return {
        subject: "Activer votre abonnement Ubion Pro",
        text: [
          `Bonjour ${name},`,
          "",
          `Pour réactiver l'accès complet à Ubion pour ${restaurant}, vous pouvez souscrire ici :`,
          `${appUrl}/settings/billing`,
          "",
          `Tarif : ${formatBillingOfferDetail()} — sans engagement, résiliable à tout moment.`,
          "",
          "Si vous rencontrez un souci de paiement, dites-le moi et je vous aide.",
          "",
          "Medhi — Ubion",
        ].join("\n"),
      };
    case "custom":
    default:
      return {
        subject: "",
        text: [
          `Bonjour ${name},`,
          "",
          "",
          "Medhi — Ubion",
        ].join("\n"),
      };
  }
}
