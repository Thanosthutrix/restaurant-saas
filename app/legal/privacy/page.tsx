import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { absoluteUrl } from "@/lib/seo/siteUrl";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Politique de confidentialité et protection des données personnelles — Ubion.",
  openGraph: {
    title: "Politique de confidentialité · Ubion",
    url: absoluteUrl("/legal/privacy"),
  },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title="Politique de confidentialité"
      updatedAt="23 août 2026"
      intro="Ubion (« nous ») édite une plateforme SaaS destinée aux restaurateurs (Ubion Pro) et un portail public de découverte de restaurants. La présente politique décrit comment nous collectons, utilisons et protégeons vos données personnelles, conformément au Règlement général sur la protection des données (RGPD)."
      sections={[
        {
          title: "1. Responsable du traitement",
          paragraphs: [
            "Le responsable du traitement est Ubion. Pour toute question relative à vos données : contact@ubion.fr.",
          ],
        },
        {
          title: "2. Données collectées",
          paragraphs: ["Nous pouvons traiter les catégories de données suivantes :"],
          list: [
            "Identité et contact : nom, prénom, adresse e-mail, numéro de téléphone (le cas échéant).",
            "Compte utilisateur : identifiants de connexion, rôle (propriétaire, collaborateur, consommateur).",
            "Données d'établissement : nom du restaurant, adresse, horaires, contenus publiés (carte, photos, avis).",
            "Données d'usage : journaux techniques, pages consultées, appareil, adresse IP (courte durée).",
            "Données de paiement : traitées par Stripe ; nous ne stockons pas les numéros de carte bancaire.",
            "Notifications push : token d'appareil (app mobile native), si vous y consentez.",
            "Données RH et opérationnelles saisies par le restaurateur dans son espace (planning, stocks, hygiène, etc.).",
          ],
        },
        {
          title: "3. Finalités et bases légales",
          paragraphs: [
            "Nous utilisons vos données pour fournir et améliorer le service, gérer votre compte, traiter les abonnements, envoyer des notifications liées au service, assurer la sécurité et respecter nos obligations légales.",
            "Les bases légales sont l'exécution du contrat (CGV/CGU), votre consentement (notifications, cookies non essentiels), nos intérêts légitimes (sécurité, amélioration du produit) et les obligations légales.",
          ],
        },
        {
          title: "4. Destinataires et sous-traitants",
          paragraphs: ["Vos données peuvent être traitées par des prestataires agissant pour notre compte, notamment :"],
          list: [
            "Supabase (hébergement base de données et authentification)",
            "Vercel (hébergement application web)",
            "Stripe (paiements et abonnements)",
            "Resend (envoi d'e-mails transactionnels)",
            "Apple / Google (notifications push sur app native)",
            "OpenAI ou prestataires IA (fonctionnalités d'assistance, si activées)",
          ],
        },
        {
          title: "5. Durée de conservation",
          paragraphs: [
            "Les données de compte sont conservées tant que le compte est actif, puis supprimées ou anonymisées dans un délai raisonnable après suppression du compte (fonction disponible dans les paramètres).",
            "Les données de facturation peuvent être conservées plus longtemps pour respecter les obligations comptables et fiscales.",
          ],
        },
        {
          title: "6. Vos droits",
          paragraphs: [
            "Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité, ainsi que du droit de retirer votre consentement à tout moment lorsque le traitement est fondé sur celui-ci.",
            "Vous pouvez introduire une réclamation auprès de la CNIL (www.cnil.fr).",
          ],
        },
        {
          title: "7. Sécurité",
          paragraphs: [
            "Nous mettons en œuvre des mesures techniques et organisationnelles appropriées (chiffrement en transit, contrôle d'accès, sauvegardes). Aucune transmission sur Internet n'est toutefois garantie à 100 %.",
          ],
        },
        {
          title: "8. Transferts hors UE",
          paragraphs: [
            "Certains sous-traitants peuvent être situés hors de l'Union européenne. Le cas échéant, nous nous assurons de garanties appropriées (clauses contractuelles types ou décision d'adéquation).",
          ],
        },
        {
          title: "9. Modifications",
          paragraphs: [
            "Nous pouvons mettre à jour cette politique. La date de dernière mise à jour figure en tête de page. En cas de changement substantiel, nous vous en informerons par des moyens appropriés.",
          ],
        },
      ]}
    />
  );
}
