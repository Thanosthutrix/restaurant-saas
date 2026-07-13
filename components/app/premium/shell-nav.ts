import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  PlusCircle,
  UserRound,
  Armchair,
  Wallet,
  Droplets,
  ChefHat,
  Users,
  UserCircle2,
  BookUser,
  CalendarCheck,
  Archive,
  BarChart3,
  Truck,
} from "lucide-react";
import type { ShellNavKey } from "@/lib/auth/appRoles";

export type ShellNavGroup = "Accueil" | "Service" | "Gestion";

export type ShellNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  navKey: ShellNavKey;
  group: ShellNavGroup;
  match: (pathname: string) => boolean;
  /**
   * Pages couvertes par ce hub : l'entrée reste visible si l'utilisateur a
   * accès à l'une d'elles, même sans la clé du hub lui-même.
   */
  coveredKeys?: ShellNavKey[];
  /**
   * Masque l'entrée si l'utilisateur possède l'une de ces clés — utilisé pour
   * les entrées de repli dont la destination est déjà couverte par un hub.
   */
  hideIfKeys?: ShellNavKey[];
};

/**
 * Navigation condensée en deux mondes :
 * - « Service » : ce qu'on ouvre pendant le coup de feu.
 * - « Gestion » : le travail de bureau, au calme.
 * Les sous-pages (plats, stock, fournisseurs…) vivent dans les hubs
 * (/cuisine, /achats, /pilotage) — pas dans la sidebar.
 */
export const SHELL_NAV_ITEMS: ShellNavItem[] = [
  {
    href: "/dashboard",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    navKey: "dashboard",
    group: "Accueil",
    match: (p) => p === "/dashboard",
  },

  // ── Service ────────────────────────────────────────────────────────────
  {
    href: "/salle",
    label: "Salle",
    icon: Armchair,
    navKey: "salle",
    group: "Service",
    match: (p) => p.startsWith("/salle"),
  },
  {
    href: "/caisse",
    label: "Caisse",
    icon: Wallet,
    navKey: "caisse",
    group: "Service",
    match: (p) => p.startsWith("/caisse"),
  },
  {
    href: "/reservations",
    label: "Réservations",
    icon: CalendarCheck,
    navKey: "reservations",
    group: "Service",
    match: (p) => p === "/reservations" || p.startsWith("/reservations/"),
  },
  {
    href: "/clients",
    label: "Base clients",
    icon: BookUser,
    navKey: "clients",
    group: "Service",
    match: (p) => p === "/clients" || p.startsWith("/clients/"),
  },
  {
    href: "/cuisine",
    label: "Cuisine",
    icon: ChefHat,
    navKey: "cuisine",
    group: "Service",
    coveredKeys: ["dishes", "preparations", "inventory", "service_new"],
    match: (p) =>
      p === "/cuisine" ||
      p === "/dishes" ||
      p.startsWith("/dishes/") ||
      p === "/preparations" ||
      p.startsWith("/preparations/") ||
      p === "/inventory" ||
      p.startsWith("/inventory/") ||
      p === "/service/new",
  },
  {
    href: "/hygiene",
    label: "Hygiène",
    icon: Droplets,
    navKey: "hygiene",
    group: "Service",
    match: (p) => p === "/hygiene" || p.startsWith("/hygiene/"),
  },
  {
    // Repli pour les rôles « service » sans accès au hub Cuisine.
    href: "/service/new",
    label: "Nouveau service",
    icon: PlusCircle,
    navKey: "service_new",
    group: "Service",
    hideIfKeys: ["cuisine"],
    match: (p) => p === "/service/new",
  },

  // ── Gestion ────────────────────────────────────────────────────────────
  {
    href: "/achats",
    label: "Achats & stock",
    icon: Truck,
    navKey: "achats",
    group: "Gestion",
    coveredKeys: ["suppliers", "supplier_invoices", "orders", "orders_suggestions", "livraison"],
    match: (p) =>
      p === "/achats" ||
      p.startsWith("/suppliers") ||
      p.startsWith("/supplier-invoices") ||
      p.startsWith("/orders") ||
      p.startsWith("/livraison") ||
      p.startsWith("/receiving"),
  },
  {
    href: "/pilotage",
    label: "Pilotage",
    icon: BarChart3,
    navKey: "insights",
    group: "Gestion",
    coveredKeys: ["margins", "services"],
    match: (p) =>
      p === "/pilotage" ||
      p.startsWith("/pilotage/") ||
      p.startsWith("/insights") ||
      p.startsWith("/margins") ||
      p.startsWith("/services") ||
      (p.startsWith("/service/") && p !== "/service/new"),
  },
  {
    href: "/equipe",
    label: "Équipe",
    icon: Users,
    navKey: "equipe_manage",
    group: "Gestion",
    match: (p) =>
      p === "/equipe" ||
      (p.startsWith("/equipe/") && !p.startsWith("/equipe/mon-planning")),
  },
  {
    // Repli pour les collaborateurs sans gestion d'équipe.
    href: "/equipe/mon-planning",
    label: "Mon planning",
    icon: UserCircle2,
    navKey: "equipe_self",
    group: "Gestion",
    hideIfKeys: ["equipe_manage"],
    match: (p) => p.startsWith("/equipe/mon-planning"),
  },
  {
    href: "/registres",
    label: "Registres",
    icon: Archive,
    navKey: "registres",
    group: "Gestion",
    match: (p) => p === "/registres",
  },
  {
    href: "/account",
    label: "Compte",
    icon: UserRound,
    navKey: "account",
    group: "Gestion",
    match: (p) => p === "/account" || p.startsWith("/account/"),
  },
];

export function isBareShellPath(pathname: string | null): boolean {
  if (!pathname) return true;
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/restaurant/") ||
    pathname.startsWith("/compte") ||
    pathname.startsWith("/meta/oauth")
  );
}
