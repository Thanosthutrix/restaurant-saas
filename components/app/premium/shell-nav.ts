import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  UtensilsCrossed,
  Package,
  Percent,
  CalendarDays,
  Truck,
  Sparkles,
  ShoppingCart,
  UserRound,
  Armchair,
  Wallet,
  PackageOpen,
  Droplets,
  ChefHat,
  Users,
  UserCircle2,
  BookUser,
  CalendarCheck,
  Archive,
} from "lucide-react";
import type { ShellNavKey } from "@/lib/auth/appRoles";

export type ShellNavGroup =
  | "Accueil"
  | "Exploitation"
  | "Cuisine"
  | "Achats & stock"
  | "Registres"
  | "Équipe & compte";

export type ShellNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  navKey: ShellNavKey;
  group: ShellNavGroup;
  match: (pathname: string) => boolean;
};

export const SHELL_NAV_ITEMS: ShellNavItem[] = [
  {
    href: "/dashboard",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    navKey: "dashboard",
    group: "Accueil",
    match: (p) => p === "/dashboard",
  },
  {
    href: "/cuisine",
    label: "Cuisine",
    icon: ChefHat,
    navKey: "cuisine",
    group: "Cuisine",
    match: (p) => p === "/cuisine",
  },
  {
    href: "/achats",
    label: "Achats & stock",
    icon: Truck,
    navKey: "achats",
    group: "Achats & stock",
    match: (p) => p === "/achats",
  },
  {
    href: "/registres",
    label: "Registres",
    icon: Archive,
    navKey: "registres",
    group: "Registres",
    match: (p) => p === "/registres",
  },
  {
    href: "/service/new",
    label: "Nouveau service",
    icon: PlusCircle,
    navKey: "service_new",
    group: "Exploitation",
    match: (p) => p === "/service/new",
  },
  { href: "/salle", label: "Salle", icon: Armchair, navKey: "salle", group: "Exploitation", match: (p) => p.startsWith("/salle") },
  {
    href: "/clients",
    label: "Base clients",
    icon: BookUser,
    navKey: "clients",
    group: "Exploitation",
    match: (p) => p === "/clients" || p.startsWith("/clients/"),
  },
  {
    href: "/reservations",
    label: "Réservations",
    icon: CalendarCheck,
    navKey: "reservations",
    group: "Exploitation",
    match: (p) => p === "/reservations" || p.startsWith("/reservations/"),
  },
  { href: "/caisse", label: "Caisse", icon: Wallet, navKey: "caisse", group: "Exploitation", match: (p) => p.startsWith("/caisse") },
  {
    href: "/services",
    label: "Historique services",
    icon: ClipboardList,
    navKey: "services",
    group: "Exploitation",
    match: (p) =>
      p.startsWith("/services") || (p.startsWith("/service/") && p !== "/service/new"),
  },
  {
    href: "/dishes",
    label: "Plats",
    icon: UtensilsCrossed,
    navKey: "dishes",
    group: "Cuisine",
    match: (p) => p === "/dishes" || p.startsWith("/dishes/"),
  },
  {
    href: "/inventory",
    label: "Stock",
    icon: Package,
    navKey: "inventory",
    group: "Cuisine",
    match: (p) => p === "/inventory" || p.startsWith("/inventory/"),
  },
  {
    href: "/preparations",
    label: "Préparations",
    icon: ChefHat,
    navKey: "preparations",
    group: "Cuisine",
    match: (p) => p === "/preparations" || p.startsWith("/preparations/"),
  },
  {
    href: "/equipe",
    label: "Équipe",
    icon: Users,
    navKey: "equipe_manage",
    group: "Équipe & compte",
    match: (p) => p === "/equipe" || (p.startsWith("/equipe/") && !p.startsWith("/equipe/mon-planning")),
  },
  {
    href: "/equipe/mon-planning",
    label: "Mon planning",
    icon: UserCircle2,
    navKey: "equipe_self",
    group: "Équipe & compte",
    match: (p) => p.startsWith("/equipe/mon-planning"),
  },
  { href: "/margins", label: "Marges", icon: Percent, navKey: "margins", group: "Cuisine", match: (p) => p.startsWith("/margins") },
  {
    href: "/insights/calendar",
    label: "Pilotage calendrier",
    icon: CalendarDays,
    navKey: "insights",
    group: "Registres",
    match: (p) => p.startsWith("/insights"),
  },
  {
    href: "/livraison",
    label: "Réceptions / BL",
    icon: PackageOpen,
    navKey: "livraison",
    group: "Achats & stock",
    match: (p) => p === "/livraison" || p.startsWith("/livraison/"),
  },
  {
    href: "/hygiene",
    label: "Nettoyage & hygiène",
    icon: Droplets,
    navKey: "hygiene",
    group: "Registres",
    match: (p) => p === "/hygiene" || p.startsWith("/hygiene/"),
  },
  {
    href: "/suppliers",
    label: "Fournisseurs",
    icon: Truck,
    navKey: "suppliers",
    group: "Achats & stock",
    match: (p) => p === "/suppliers" || p.startsWith("/suppliers/"),
  },
  {
    href: "/supplier-invoices",
    label: "Factures fournisseurs",
    icon: ClipboardList,
    navKey: "supplier_invoices",
    group: "Achats & stock",
    match: (p) => p === "/supplier-invoices" || p.startsWith("/supplier-invoices/"),
  },
  {
    href: "/orders/suggestions",
    label: "Suggestions d’achat",
    icon: Sparkles,
    navKey: "orders_suggestions",
    group: "Achats & stock",
    match: (p) => p.startsWith("/orders/suggestions"),
  },
  {
    href: "/orders",
    label: "Commandes fournisseurs",
    icon: ShoppingCart,
    navKey: "orders",
    group: "Achats & stock",
    match: (p) =>
      p === "/orders" || (p.startsWith("/orders/") && !p.startsWith("/orders/suggestions")),
  },
  {
    href: "/account",
    label: "Compte",
    icon: UserRound,
    navKey: "account",
    group: "Équipe & compte",
    match: (p) => p === "/account" || p.startsWith("/account/"),
  },
];

export function isBareShellPath(pathname: string | null): boolean {
  if (!pathname) return true;
  return pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/signup");
}
