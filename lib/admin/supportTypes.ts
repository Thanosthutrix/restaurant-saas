/** Types support admin — sans dépendance serveur. */

export type AdminSupportAction =
  | "note"
  | "email_sent"
  | "impersonate"
  | "suspend"
  | "unsuspend"
  | "trial_granted"
  | "reset_password"
  | "prospect_note"
  | "prospect_status"
  | "prospect_created"
  | "invoice_viewed"
  | "trial_request_approved"
  | "trial_request_rejected"
  | "user_deleted";

export function getAdminSupportActionLabel(action: AdminSupportAction): {
  label: string;
  color: string;
} {
  switch (action) {
    case "note":
      return { label: "Note", color: "bg-gray-100 text-gray-700" };
    case "email_sent":
      return { label: "Email", color: "bg-blue-50 text-blue-700" };
    case "impersonate":
      return { label: "Impersonation", color: "bg-violet-50 text-violet-700" };
    case "suspend":
      return { label: "Suspension", color: "bg-red-50 text-red-700" };
    case "unsuspend":
      return { label: "Réactivation", color: "bg-green-50 text-green-700" };
    case "trial_granted":
      return { label: "Essai", color: "bg-amber-50 text-amber-700" };
    case "reset_password":
      return { label: "Reset MDP", color: "bg-orange-50 text-orange-700" };
    case "prospect_note":
      return { label: "Note prospect", color: "bg-indigo-50 text-indigo-700" };
    case "prospect_status":
      return { label: "Statut prospect", color: "bg-indigo-50 text-indigo-700" };
    case "prospect_created":
      return { label: "Prospect créé", color: "bg-blue-50 text-blue-700" };
    case "invoice_viewed":
      return { label: "Facture", color: "bg-stone-100 text-stone-700" };
    case "trial_request_approved":
      return { label: "Essai approuvé", color: "bg-green-50 text-green-700" };
    case "trial_request_rejected":
      return { label: "Essai refusé", color: "bg-red-50 text-red-600" };
    case "user_deleted":
      return { label: "Compte supprimé", color: "bg-red-100 text-red-800" };
    default:
      return { label: action, color: "bg-gray-100 text-gray-600" };
  }
}

export type AdminEmailTemplateId =
  | "follow_up"
  | "onboarding_checkin"
  | "trial_expiring"
  | "payment_help"
  | "custom";

export type AdminEmailTemplate = {
  id: AdminEmailTemplateId;
  label: string;
  description: string;
  defaultSubject: string;
};

export const ADMIN_EMAIL_TEMPLATES: AdminEmailTemplate[] = [
  {
    id: "follow_up",
    label: "Relance générale",
    description: "Prise de nouvelles après inscription ou démo.",
    defaultSubject: "Comment se passe votre utilisation d'Ubion ?",
  },
  {
    id: "onboarding_checkin",
    label: "Check-in onboarding",
    description: "Aider le client à finaliser sa configuration.",
    defaultSubject: "Besoin d'aide pour configurer Ubion ?",
  },
  {
    id: "trial_expiring",
    label: "Essai bientôt expiré",
    description: "Rappel avant fin de période d'essai.",
    defaultSubject: "Votre essai Ubion se termine bientôt",
  },
  {
    id: "payment_help",
    label: "Aide abonnement",
    description: "Assistance pour souscrire ou régulariser un paiement.",
    defaultSubject: "Activer votre abonnement Ubion Pro",
  },
  {
    id: "custom",
    label: "Message libre",
    description: "Sujet et corps entièrement personnalisables.",
    defaultSubject: "",
  },
];
