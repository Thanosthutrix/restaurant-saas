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
  | "cuisine"
  | "achats"
  | "registres"
  | "service_new"
  | "salle"
  | "caisse"
  | "services"
  | "dishes"
  | "dishes_readonly"
  | "inventory"
  | "inventory_readonly"
  | "preparations"
  | "equipe_manage"
  | "equipe_self"
  | "margins"
  | "insights"
  | "livraison"
  | "hygiene"
  | "suppliers"
  | "suppliers_readonly"
  | "supplier_invoices"
  | "supplier_invoices_readonly"
  | "orders_suggestions"
  | "orders"
  | "clients"
  | "clients_readonly"
  | "reservations"
  | "account"
  | "ai_assistant"
  // ── Sous-sections tableau de bord ──────────────────────────────────────
  | "dashboard_stats"
  | "dashboard_recent_services"
  | "dashboard_stock_alert";

export const ALL_SHELL_NAV_KEYS: ShellNavKey[] = [
  "dashboard",
  "cuisine",
  "achats",
  "registres",
  "service_new",
  "salle",
  "caisse",
  "services",
  "dishes",
  "dishes_readonly",
  "inventory",
  "inventory_readonly",
  "preparations",
  "equipe_manage",
  "equipe_self",
  "margins",
  "insights",
  "livraison",
  "hygiene",
  "suppliers",
  "suppliers_readonly",
  "supplier_invoices",
  "supplier_invoices_readonly",
  "orders_suggestions",
  "orders",
  "clients",
  "clients_readonly",
  "reservations",
  "account",
  "ai_assistant",
  "dashboard_stats",
  "dashboard_recent_services",
  "dashboard_stock_alert",
];

/**
 * Association clé de navigation → clé lecture seule.
 * Permet à l'UI et aux guards de connaître les couples (complet / readonly).
 */
export const NAV_KEY_READONLY_PAIRS: Partial<Record<ShellNavKey, ShellNavKey>> = {
  inventory: "inventory_readonly",
  dishes: "dishes_readonly",
  clients: "clients_readonly",
  suppliers: "suppliers_readonly",
  supplier_invoices: "supplier_invoices_readonly",
};

/** Niveau d'accès résolu pour une page donnée. */
export type PageAccessLevel = "none" | "readonly" | "full";

/**
 * Détermine si un collaborateur peut naviguer vers une page.
 * Retourne true si la clé complète OU la clé lecture seule est présente.
 */
export function canAccessPage(
  pageKey: ShellNavKey,
  allowedKeys: ShellNavKey[]
): boolean {
  if (allowedKeys.includes(pageKey)) return true;
  const ro = NAV_KEY_READONLY_PAIRS[pageKey];
  return ro != null && allowedKeys.includes(ro);
}

/**
 * Détermine si un collaborateur peut modifier les données d'une page.
 * Retourne true uniquement si la clé complète (non readonly) est présente.
 */
export function canWritePage(
  pageKey: ShellNavKey,
  allowedKeys: ShellNavKey[]
): boolean {
  return allowedKeys.includes(pageKey);
}

/**
 * Niveau d'accès résolu pour une page : aucun / lecture seule / complet.
 */
export function getPageAccessLevel(
  pageKey: ShellNavKey,
  allowedKeys: ShellNavKey[]
): PageAccessLevel {
  if (allowedKeys.includes(pageKey)) return "full";
  const ro = NAV_KEY_READONLY_PAIRS[pageKey];
  if (ro != null && allowedKeys.includes(ro)) return "readonly";
  return "none";
}

/** Permissions par rôle (MVP — à affiner avec le métier). */
export const NAV_KEYS_BY_APP_ROLE: Record<AppRole, ShellNavKey[]> = {
  manager: [...ALL_SHELL_NAV_KEYS], // inclut ai_assistant via ALL_SHELL_NAV_KEYS
  service: [
    "dashboard", "dashboard_stats", "dashboard_recent_services",
    "registres", "service_new", "salle", "caisse", "services",
    // Plats : consultation seulement (pas de modification du menu en salle)
    "dishes_readonly",
    "clients", "reservations", "equipe_self", "account",
  ],
  cuisine: [
    "dashboard", "dashboard_stats",
    "cuisine", "registres", "service_new", "services",
    "dishes", "inventory", "preparations", "equipe_self", "account",
  ],
  hygiene: [
    "dashboard",
    "registres", "hygiene",
    // Consultation du stock pour les besoins hygiène
    "inventory_readonly",
    "equipe_self", "account",
  ],
  achats: [
    "dashboard", "dashboard_stock_alert",
    "achats", "registres", "inventory", "livraison",
    "suppliers", "supplier_invoices", "orders_suggestions", "orders",
    // Consultation des clients pour les commandes
    "clients_readonly",
    "equipe_self", "account",
  ],
  lecture_seule: [
    "dashboard", "dashboard_stats",
    "inventory_readonly", "dishes_readonly",
    "account",
  ],
};

/**
 * Clés par défaut pour un collaborateur dont le rôle n'a pas encore été configuré.
 * Donne un accès de base utile : tableau de bord complet + planning personnel + compte.
 */
const DEFAULT_COLLABORATOR_KEYS: ShellNavKey[] = [
  "dashboard",
  "dashboard_stats",
  "dashboard_recent_services",
  "equipe_self",
  "account",
];

export function navKeysForAppRole(role: string | null | undefined): ShellNavKey[] {
  if (role && isAppRole(role)) {
    return [...NAV_KEYS_BY_APP_ROLE[role]];
  }
  return [...DEFAULT_COLLABORATOR_KEYS];
}

/**
 * Résout les clés de navigation autorisées pour un collaborateur.
 * Si `app_nav_keys` est défini (liste personnalisée), il prend le dessus sur `app_role`.
 */
export function resolveNavKeys(
  app_nav_keys: string[] | null | undefined,
  app_role: string | null | undefined
): ShellNavKey[] {
  if (Array.isArray(app_nav_keys) && app_nav_keys.length > 0) {
    return app_nav_keys.filter((k): k is ShellNavKey =>
      (ALL_SHELL_NAV_KEYS as string[]).includes(k)
    );
  }
  return navKeysForAppRole(app_role);
}

/** Label français pour chaque clé de navigation. */
export const NAV_KEY_LABELS_FR: Record<ShellNavKey, string> = {
  dashboard: "Tableau de bord",
  dashboard_stats: "Statistiques (ventes, stock…)",
  dashboard_recent_services: "Derniers services",
  dashboard_stock_alert: "Alerte stock bas",
  cuisine: "Cuisine",
  achats: "Module achats",
  registres: "Registres",
  service_new: "Service",
  salle: "Salle & commandes",
  caisse: "Caisse",
  services: "Services réalisés",
  dishes: "Plats & menus",
  dishes_readonly: "Plats & menus (lecture)",
  inventory: "Inventaire & stock",
  inventory_readonly: "Inventaire & stock (lecture)",
  preparations: "Préparations",
  equipe_manage: "Équipe (gestion)",
  equipe_self: "Mon planning",
  margins: "Marges",
  insights: "Analyses & ventes",
  livraison: "Livraisons",
  hygiene: "Hygiène",
  suppliers: "Fournisseurs",
  suppliers_readonly: "Fournisseurs (lecture)",
  supplier_invoices: "Factures fournisseurs",
  supplier_invoices_readonly: "Factures fournisseurs (lecture)",
  orders_suggestions: "Suggestions de commande",
  orders: "Bons de commande",
  clients: "Clients & fidélité",
  clients_readonly: "Clients & fidélité (lecture)",
  reservations: "Réservations",
  account: "Mon compte",
  ai_assistant: "Assistant IA (import)",
};

/**
 * Groupes pour l'affichage des permissions dans l'UI.
 * Les clés _readonly ne sont PAS listées ici : elles sont gérées via les contrôles 3-états
 * dans NavPermissionsEditor pour les pages qui ont un NAV_KEY_READONLY_PAIRS associé.
 */
export const NAV_KEY_GROUPS: { label: string; keys: ShellNavKey[] }[] = [
  {
    label: "Général",
    keys: ["dashboard", "account", "equipe_self", "ai_assistant"],
  },
  {
    label: "Tableau de bord — rubriques",
    keys: ["dashboard_stats", "dashboard_recent_services", "dashboard_stock_alert"],
  },
  {
    label: "Service & salle",
    keys: ["registres", "service_new", "salle", "caisse", "services", "dishes", "clients", "reservations"],
  },
  {
    label: "Cuisine & stock",
    keys: ["cuisine", "inventory", "preparations"],
  },
  {
    label: "Achats & fournisseurs",
    keys: ["achats", "livraison", "suppliers", "supplier_invoices", "orders_suggestions", "orders"],
  },
  {
    label: "Gestion",
    keys: ["equipe_manage", "margins", "insights", "hygiene"],
  },
];
