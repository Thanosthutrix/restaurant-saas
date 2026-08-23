import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  FlaskConical,
  Wallet,
  Settings,
  FileText,
  Headphones,
  Building2,
  CalendarDays,
} from "lucide-react";

export type AdminNavKey =
  | "home"
  | "clients"
  | "company"
  | "company_pocket"
  | "company_invoices"
  | "company_emitted"
  | "company_contracts"
  | "company_team"
  | "prospects"
  | "trial_requests"
  | "invoices"
  | "support"
  | "trials"
  | "finances"
  | "settings";

export type AdminNavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  navKey: AdminNavKey;
  match: (pathname: string) => boolean;
  badgeKey?: "trialRequests";
};

/** Onglets principaux de la barre du bas admin. */
export const ADMIN_BOTTOM_TAB_KEYS: AdminNavKey[] = [
  "home",
  "clients",
  "company",
  "company_pocket",
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    href: "/admin",
    label: "Tableau de bord",
    shortLabel: "Accueil",
    icon: LayoutDashboard,
    navKey: "home",
    match: (p) => p === "/admin",
  },
  {
    href: "/admin/restaurants",
    label: "Clients",
    icon: Users,
    navKey: "clients",
    match: (p) => p === "/admin/restaurants" || p.startsWith("/admin/restaurants/"),
  },
  {
    href: "/admin/company",
    label: "Ma société",
    shortLabel: "Société",
    icon: Building2,
    navKey: "company",
    match: (p) => p === "/admin/company",
  },
  {
    href: "/admin/company/pocket",
    label: "Ma poche",
    shortLabel: "Poche",
    icon: Wallet,
    navKey: "company_pocket",
    match: (p) => p.startsWith("/admin/company/pocket"),
  },
  {
    href: "/admin/company/invoices",
    label: "Mes factures",
    icon: FileText,
    navKey: "company_invoices",
    match: (p) => p.startsWith("/admin/company/invoices"),
  },
  {
    href: "/admin/company/team",
    label: "Équipe & planning",
    icon: CalendarDays,
    navKey: "company_team",
    match: (p) => p.startsWith("/admin/company/team"),
  },
  {
    href: "/admin/company/emitted",
    label: "Factures émises",
    icon: FileText,
    navKey: "company_emitted",
    match: (p) => p.startsWith("/admin/company/emitted"),
  },
  {
    href: "/admin/company/contracts",
    label: "Contrats RH",
    icon: FileText,
    navKey: "company_contracts",
    match: (p) => p.startsWith("/admin/company/contracts"),
  },
  {
    href: "/admin/prospects",
    label: "Prospects",
    icon: UserPlus,
    navKey: "prospects",
    match: (p) => p === "/admin/prospects" || p.startsWith("/admin/prospects/"),
  },
  {
    href: "/admin/trial-requests",
    label: "Essais demandés",
    icon: FlaskConical,
    navKey: "trial_requests",
    match: (p) => p === "/admin/trial-requests" || p.startsWith("/admin/trial-requests/"),
    badgeKey: "trialRequests",
  },
  {
    href: "/admin/invoices",
    label: "Factures clients (support)",
    icon: FileText,
    navKey: "invoices",
    match: (p) => p === "/admin/invoices" || p.startsWith("/admin/invoices/"),
  },
  {
    href: "/admin/support",
    label: "Support",
    icon: Headphones,
    navKey: "support",
    match: (p) => p === "/admin/support" || p.startsWith("/admin/support/"),
  },
  {
    href: "/admin/trials",
    label: "Essais",
    icon: FlaskConical,
    navKey: "trials",
    match: (p) => p === "/admin/trials" || p.startsWith("/admin/trials/"),
  },
  {
    href: "/admin/finances",
    label: "Revenus SaaS",
    icon: Wallet,
    navKey: "finances",
    match: (p) => p === "/admin/finances" || p.startsWith("/admin/finances/"),
  },
  {
    href: "/admin/settings",
    label: "Paramètres",
    icon: Settings,
    navKey: "settings",
    match: (p) => p === "/admin/settings" || p.startsWith("/admin/settings/"),
  },
];

export function isAdminToolPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return ADMIN_NAV_ITEMS.some((item) => item.match(pathname));
}

export function isAdminOnlyPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
