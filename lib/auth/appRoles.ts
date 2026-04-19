/**
 * Rôles applicatifs (collaborateurs avec compte lié).
 * Le propriétaire du restaurant (restaurants.owner_id) a toujours accès complet.
 */
export const APP_ROLES = [
  "manager",
  "service",
  "cuisine",
  "hygiene",
  "achats",
  "lecture_seule",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function isAppRole(s: string | null | undefined): s is AppRole {
  return s != null && (APP_ROLES as readonly string[]).includes(s);
}

/** Clés alignées sur les entrées du menu (shell-nav). */
export type ShellNavKey =
  | "dashboard"
  | "service_new"
  | "salle"
  | "caisse"
  | "services"
  | "dishes"
  | "inventory"
  | "preparations"
  | "equipe_manage"
  | "equipe_self"
  | "margins"
  | "insights"
  | "livraison"
  | "hygiene"
  | "suppliers"
  | "orders_suggestions"
  | "orders"
  | "account";

export const ALL_SHELL_NAV_KEYS: ShellNavKey[] = [
  "dashboard",
  "service_new",
  "salle",
  "caisse",
  "services",
  "dishes",
  "inventory",
  "preparations",
  "equipe_manage",
  "equipe_self",
  "margins",
  "insights",
  "livraison",
  "hygiene",
  "suppliers",
  "orders_suggestions",
  "orders",
  "account",
];

/** Permissions par rôle (MVP — à affiner avec le métier). */
export const NAV_KEYS_BY_APP_ROLE: Record<AppRole, ShellNavKey[]> = {
  manager: [...ALL_SHELL_NAV_KEYS],
  service: [
    "dashboard",
    "service_new",
    "salle",
    "caisse",
    "services",
    "dishes",
    "equipe_self",
    "account",
  ],
  cuisine: [
    "dashboard",
    "service_new",
    "services",
    "dishes",
    "inventory",
    "preparations",
    "equipe_self",
    "account",
  ],
  hygiene: ["dashboard", "hygiene", "equipe_self", "account"],
  achats: [
    "dashboard",
    "inventory",
    "livraison",
    "suppliers",
    "orders_suggestions",
    "orders",
    "equipe_self",
    "account",
  ],
  lecture_seule: ["dashboard", "account"],
};

export function navKeysForAppRole(role: string | null | undefined): ShellNavKey[] {
  if (role && isAppRole(role)) {
    return [...NAV_KEYS_BY_APP_ROLE[role]];
  }
  return [...NAV_KEYS_BY_APP_ROLE.lecture_seule];
}
