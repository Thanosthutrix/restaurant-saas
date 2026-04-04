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
} from "lucide-react";

export type ShellNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
};

export const SHELL_NAV_ITEMS: ShellNavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard, match: (p) => p === "/dashboard" },
  { href: "/service/new", label: "Nouveau service", icon: PlusCircle, match: (p) => p === "/service/new" },
  { href: "/salle", label: "Salle", icon: Armchair, match: (p) => p.startsWith("/salle") },
  { href: "/caisse", label: "Caisse", icon: Wallet, match: (p) => p.startsWith("/caisse") },
  {
    href: "/services",
    label: "Historique services",
    icon: ClipboardList,
    match: (p) =>
      p.startsWith("/services") || (p.startsWith("/service/") && p !== "/service/new"),
  },
  { href: "/dishes", label: "Plats", icon: UtensilsCrossed, match: (p) => p === "/dishes" || p.startsWith("/dishes/") },
  {
    href: "/inventory",
    label: "Stock",
    icon: Package,
    match: (p) => p === "/inventory" || p.startsWith("/inventory/"),
  },
  { href: "/margins", label: "Marges", icon: Percent, match: (p) => p.startsWith("/margins") },
  {
    href: "/insights/calendar",
    label: "Calendrier",
    icon: CalendarDays,
    match: (p) => p.startsWith("/insights"),
  },
  {
    href: "/suppliers",
    label: "Fournisseurs",
    icon: Truck,
    match: (p) => p === "/suppliers" || p.startsWith("/suppliers/"),
  },
  {
    href: "/orders/suggestions",
    label: "Commandes suggérées",
    icon: Sparkles,
    match: (p) => p.startsWith("/orders/suggestions"),
  },
  {
    href: "/orders",
    label: "Commandes",
    icon: ShoppingCart,
    match: (p) =>
      p === "/orders" || (p.startsWith("/orders/") && !p.startsWith("/orders/suggestions")),
  },
  { href: "/account", label: "Compte", icon: UserRound, match: (p) => p === "/account" },
];

export function isBareShellPath(pathname: string | null): boolean {
  if (!pathname) return true;
  return pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/signup");
}
