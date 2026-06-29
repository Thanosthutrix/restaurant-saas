import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, BarChart3, CalendarDays, ClipboardList, Percent } from "lucide-react";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { ALL_SHELL_NAV_KEYS, canAccessPage, type ShellNavKey } from "@/lib/auth/appRoles";
import { uiCard } from "@/components/ui/premium";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";

const tiles: {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  navKey: ShellNavKey;
  tone: string;
}[] = [
  {
    title: "Analyse des ventes",
    description: "Ce qui se vend, quand, et comment le mix produit évolue.",
    href: "/insights/ventes",
    icon: BarChart3,
    navKey: "insights",
    tone: "bg-copper-50 text-copper-700",
  },
  {
    title: "Pilotage calendrier",
    description: "Prévision d'activité jour par jour : météo, vacances, événements.",
    href: "/insights/calendar",
    icon: CalendarDays,
    navKey: "insights",
    tone: "bg-sky-50 text-sky-700",
  },
  {
    title: "Marges",
    description: "Marges théoriques et réelles, plat par plat, après achats et BL.",
    href: "/margins",
    icon: Percent,
    navKey: "margins",
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    title: "Historique services",
    description: "Tous les services passés et leurs tickets, pour vérifier ou corriger.",
    href: "/services",
    icon: ClipboardList,
    navKey: "services",
    tone: "bg-violet-50 text-violet-700",
  },
];

export default async function PilotagePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const accessContext = await getShellAccessContext(user.id);
  const allowed = accessContext?.allowedNavKeys ?? [...ALL_SHELL_NAV_KEYS];
  const isOwner = accessContext?.isOwner ?? false;
  const visibleTiles = tiles.filter((t) => isOwner || canAccessPage(t.navKey, allowed));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Espace gestion"
        title="Pilotage"
        subtitle="Les chiffres pour décider : ventes, marges, prévisions d'activité et historique des services."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {visibleTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.href} href={tile.href} className={`${uiCard} group block transition hover:-translate-y-0.5 hover:shadow-md`}>
              <div className="flex items-start justify-between gap-3">
                <div className={`rounded-xl p-2.5 ${tile.tone}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <ArrowUpRight className="h-4 w-4 text-stone-300 transition group-hover:text-copper-600" aria-hidden />
              </div>
              <p className="mt-3 text-sm font-semibold text-stone-900">{tile.title}</p>
              <p className="mt-1 text-xs leading-5 text-stone-500">{tile.description}</p>
            </Link>
          );
        })}
      </div>
    </PageContainer>
  );
}
