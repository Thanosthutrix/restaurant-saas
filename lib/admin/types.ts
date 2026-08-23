/** Types et helpers admin — sans dépendance serveur (importables côté client). */

export type AdminRestaurant = {
  id: string;
  name: string;
  owner_id: string;
  owner_email: string | null;
  owner_name: string | null;
  owner_last_sign_in: string | null;
  activity_type: string | null;
  created_at: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  trial: AdminTrialAccess | null;
};

export type AdminTrialAccess = {
  id: string;
  restaurant_id: string;
  source: string;
  expires_at: string;
  notes: string | null;
  created_at: string;
};

export type AdminNote = {
  id: string;
  restaurant_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
};

export type AdminUsageMetrics = {
  supplierInvoicesCount: number;
  deliveryNotesCount: number;
  suppliersCount: number;
  ticketImportsCount: number;
  staffMembersCount: number;
  reservationsCount: number;
};

export type AdminStats = {
  totalRestaurants: number;
  newThisMonth: number;
  activeTrials: number;
  inactiveCount: number;
  activeProspects: number;
};

export type AdminProspectStatus =
  | "new"
  | "contacted"
  | "demo_scheduled"
  | "invited"
  | "signed_up"
  | "lost";

export type AdminProspect = {
  id: string;
  contact_name: string | null;
  contact_email: string;
  restaurant_name: string | null;
  phone: string | null;
  source: string;
  status: AdminProspectStatus;
  notes: string | null;
  invite_token: string;
  invite_expires_at: string | null;
  invite_consumed_at: string | null;
  trial_days: number | null;
  restaurant_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminProspectNote = {
  id: string;
  prospect_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
};

export function getAdminProspectStatusLabel(status: AdminProspectStatus): { label: string; color: string } {
  switch (status) {
    case "new":
      return { label: "Nouveau", color: "bg-blue-50 text-blue-700" };
    case "contacted":
      return { label: "Contacté", color: "bg-indigo-50 text-indigo-700" };
    case "demo_scheduled":
      return { label: "Démo planifiée", color: "bg-violet-50 text-violet-700" };
    case "invited":
      return { label: "Invité", color: "bg-amber-50 text-amber-700" };
    case "signed_up":
      return { label: "Inscrit", color: "bg-green-50 text-green-700" };
    case "lost":
      return { label: "Perdu", color: "bg-gray-100 text-gray-500" };
    default:
      return { label: status, color: "bg-gray-100 text-gray-600" };
  }
}

export function getAdminProspectSourceLabel(source: string): string {
  switch (source) {
    case "inbound":
      return "Entrant";
    case "referral":
      return "Referral";
    case "event":
      return "Événement";
    case "outbound":
    default:
      return "Démarchage";
  }
}

export function isProspectInviteActive(p: AdminProspect, now = new Date()): boolean {
  if (p.invite_consumed_at) return false;
  if (p.status === "signed_up" || p.status === "lost") return false;
  if (p.invite_expires_at && new Date(p.invite_expires_at) <= now) return false;
  return true;
}

export type AdminClientStatus = "suspended" | "trial" | "trial_expired" | "active" | "inactive";

export const INACTIVE_DAYS_DEFAULT = 7;

export function getAdminClientStatus(r: AdminRestaurant, now = new Date()): AdminClientStatus {
  if (r.suspended_at) return "suspended";
  if (r.trial && new Date(r.trial.expires_at) > now) return "trial";
  if (r.trial && new Date(r.trial.expires_at) <= now) return "trial_expired";
  if (isInactiveClient(r, INACTIVE_DAYS_DEFAULT, now)) return "inactive";
  return "active";
}

export function isInactiveClient(
  r: AdminRestaurant,
  days = INACTIVE_DAYS_DEFAULT,
  now = new Date()
): boolean {
  if (r.suspended_at) return false;
  if (!r.owner_last_sign_in) return true;
  const cutoff = now.getTime() - days * 86400000;
  return new Date(r.owner_last_sign_in).getTime() < cutoff;
}

export function getAdminClientStatusLabel(status: AdminClientStatus): { label: string; color: string } {
  switch (status) {
    case "suspended":
      return { label: "Suspendu", color: "bg-red-50 text-red-600" };
    case "trial":
      return { label: "Essai", color: "bg-amber-50 text-amber-700" };
    case "trial_expired":
      return { label: "Essai expiré", color: "bg-gray-100 text-gray-500" };
    case "inactive":
      return { label: "Inactif 7j+", color: "bg-orange-50 text-orange-700" };
    default:
      return { label: "Actif", color: "bg-green-50 text-green-700" };
  }
}
