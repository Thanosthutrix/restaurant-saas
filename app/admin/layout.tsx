/**
 * Layout de l'espace admin Ubion.
 * Double protection : le middleware bloque déjà les non-admins,
 * mais on revérifie ici pour être sûr.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  FlaskConical,
  Wallet,
  Settings,
  LogOut,
  FileText,
  Headphones,
} from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { countPendingTrialRequests } from "@/lib/pro/trialRequestDb";
import { AdminPendingTrialAlert } from "@/components/admin/AdminPendingTrialAlert";

const NAV_ITEMS = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/admin/prospects", label: "Prospects", icon: UserPlus },
  { href: "/admin/trial-requests", label: "Essais demandés", icon: FlaskConical, badgeKey: "trialRequests" as const },
  { href: "/admin/restaurants", label: "Clients", icon: Users },
  { href: "/admin/invoices", label: "Factures", icon: FileText },
  { href: "/admin/support", label: "Support", icon: Headphones },
  { href: "/admin/trials", label: "Essais", icon: FlaskConical },
  { href: "/admin/finances", label: "Finances", icon: Wallet },
  { href: "/admin/settings", label: "Paramètres", icon: Settings },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAdmin, user, pendingTrialCount] = await Promise.all([
    isCurrentUserAdmin(),
    getCurrentUser(),
    countPendingTrialRequests(),
  ]);

  if (!isAdmin) redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 flex flex-col bg-white border-r border-gray-100 shadow-sm">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">U</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Ubion Admin</p>
              <p className="text-xs text-amber-600 font-medium">Espace fondateur</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact, badgeKey }) => (
            <AdminNavLink
              key={href}
              href={href}
              label={label}
              icon={<Icon size={16} />}
              exact={exact}
              badge={badgeKey === "trialRequests" && pendingTrialCount > 0 ? pendingTrialCount : undefined}
              highlight={badgeKey === "trialRequests" && pendingTrialCount > 0}
            />
          ))}
        </nav>

        {/* User + déconnexion */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center">
              <span className="text-amber-700 text-xs font-bold">M</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">
                {user?.email ?? "Medhi"}
              </p>
              <p className="text-xs text-gray-400">Super admin</p>
            </div>
          </div>
          <a
            href="/api/auth/signout"
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <LogOut size={13} />
            Déconnexion
          </a>
        </div>
      </aside>

      {/* ── Contenu ───────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto [&_input:not([type=checkbox]):not([type=radio])]:text-gray-900 [&_input:not([type=checkbox]):not([type=radio])]:[color-scheme:light] [&_select]:text-gray-900 [&_select]:[color-scheme:light] [&_textarea]:text-gray-900 [&_textarea]:[color-scheme:light]">
        <AdminPendingTrialAlert count={pendingTrialCount} variant="banner" />
        {children}
      </main>
    </div>
  );
}

/**
 * Lien de navigation avec état actif géré côté client.
 * On utilise un Server Component simple avec une classe statique —
 * l'état actif est géré via pathname dans un Client Component séparé.
 */
function AdminNavLink({
  href,
  label,
  icon,
  exact = false,
  badge,
  highlight = false,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  badge?: number;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
        highlight
          ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300 animate-pulse"
          : "text-gray-600 hover:bg-amber-50 hover:text-amber-700"
      }`}
    >
      <span
        className={`transition-colors ${
          highlight ? "text-amber-600" : "text-gray-400 group-hover:text-amber-600"
        }`}
      >
        {icon}
      </span>
      <span className="flex-1 font-medium">{label}</span>
      {badge != null && badge > 0 && (
        <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[0.65rem] font-bold leading-none text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
