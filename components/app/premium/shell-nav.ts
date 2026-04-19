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
} from "lucide-react";
import type { ShellNavKey } from "@/lib/auth/appRoles";

export type ShellNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  navKey: ShellNavKey;
  match: (pathname: string) => boolean;
};

export const SHELL_NAV_ITEMS: ShellNavItem[] = [
  {
    href: "/dashboard",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    navKey: "dashboard",
    match: (p) => p === "/dashboard",
  },
  {
    href: "/service/new",
    label: "Nouveau service",
    icon: PlusCircle,
    navKey: "service_new",
    match: (p) => p === "/service/new",
  },
  { href: "/salle", label: "Salle", icon: Armchair, navKey: "salle", match: (p) => p.startsWith("/salle") },
  { href: "/caisse", label: "Caisse", icon: Wallet, navKey: "caisse", match: (p) => p.startsWith("/caisse") },
  {
    href: "/services",
    label: "Historique services",
    icon: ClipboardList,
    navKey: "services",
    match: (p) =>
      p.startsWith("/services") || (p.startsWith("/service/") && p !== "/service/new"),
  },
  {
    href: "/dishes",
    label: "Plats",
    icon: UtensilsCrossed,
    navKey: "dishes",
    match: (p) => p === "/dishes" || p.startsWith("/dishes/"),
  },
  {
    href: "/inventory",
    label: "Stock",
    icon: Package,
    navKey: "inventory",
    match: (p) => p === "/inventory" || p.startsWith("/inventory/"),
  },
  {
    href: "/preparations",
    label: "Préparations",
    icon: ChefHat,
    navKey: "preparations",
    match: (p) => p === "/preparations" || p.startsWith("/preparations/"),
  },
  {
    href: "/equipe",
    label: "Équipe",
    icon: Users,
    navKey: "equipe_manage",
    match: (p) => p === "/equipe" || (p.startsWith("/equipe/") && !p.startsWith("/equipe/mon-planning")),
  },
  {
    href: "/equipe/mon-planning",
    label: "Mon planning",
    icon: UserCircle2,
    navKey: "equipe_self",
    match: (p) => p.startsWith("/equipe/mon-planning"),
  },
  { href: "/margins", label: "Marges", icon: Percent, navKey: "margins", match: (p) => p.startsWith("/margins") },
  {
    href: "/insights/calendar",
    label: "Calendrier",
    icon: CalendarDays,
    navKey: "insights",
    match: (p) => p.startsWith("/insights"),
  },
  {
    href: "/livraison",
    label: "Livraison",
    icon: PackageOpen,
    navKey: "livraison",
    match: (p) => p === "/livraison" || p.startsWith("/livraison/"),
  },
  {
    href: "/hygiene",
    label: "Nettoyage",
    icon: Droplets,
    navKey: "hygiene",
    match: (p) => p === "/hygiene" || p.startsWith("/hygiene/"),
  },
  {
    href: "/suppliers",
    label: "Fournisseurs",
    icon: Truck,
    navKey: "suppliers",
    match: (p) => p === "/suppliers" || p.startsWith("/suppliers/"),
  },
  {
    href: "/orders/suggestions",
    label: "Commandes suggérées",
    icon: Sparkles,
    navKey: "orders_suggestions",
    match: (p) => p.startsWith("/orders/suggestions"),
  },
  {
    href: "/orders",
    label: "Commandes",
    icon: ShoppingCart,
    navKey: "orders",
    match: (p) =>
      p === "/orders" || (p.startsWith("/orders/") && !p.startsWith("/orders/suggestions")),
  },
  {
    href: "/account",
    label: "Compte",
    icon: UserRound,
    navKey: "account",
    match: (p) => p === "/account" || p.startsWith("/account/"),
  },
];

export function isBareShellPath(pathname: string | null): boolean {
  if (!pathname) return true;
  return pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/signup");
}
