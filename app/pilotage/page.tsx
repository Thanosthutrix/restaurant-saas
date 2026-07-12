import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { BarChart3, CalendarDays, ClipboardList, Percent, Users, Wallet } from "lucide-react";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { ALL_SHELL_NAV_KEYS, canAccessPage, type ShellNavKey } from "@/lib/auth/appRoles";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";

const tiles: {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  navKey: ShellNavKey;
  tone: string;
  tile: string;
  /** Finances de l'établissement : visible uniquement par le propriétaire. */
  ownerOnly?: boolean;
}[] = [
  {
    title: "Ma poche",
    description: "Ce qu'il vous reste sur la période : CA − matière − salaires − charges.",
    href: "/pilotage/bilan",
    icon: Wallet,
    navKey: "margins",
    tone: "bg-copper-50 text-copper-700",
    tile: "tile-copper",
    ownerOnly: true,
  },
  {
    title: "Analyse des ventes",
    description: "Ce qui se vend, quand, et comment le mix produit évolue.",
    href: "/insights/ventes",
    icon: BarChart3,
    navKey: "insights",
    tone: "bg-copper-50 text-copper-700",
    tile: "tile-copper",
  },
  {
    title: "Pilotage calendrier",
    description: "Prévision d'activité jour par jour : météo, vacances, événements.",
    href: "/insights/calendar",
    icon: CalendarDays,
    navKey: "insights",
    tone: "bg-sky-50 text-sky-700",
    tile: "tile-sky",
  },
  {
    title: "Marges",
    description: "Marges théoriques et réelles, plat par plat, après achats et BL.",
    href: "/margins",
    icon: Percent,
    navKey: "margins",
    tone: "bg-emerald-50 text-emerald-700",
    tile: "tile-emerald",
  },
  {
    title: "Historique services",
    description: "Tous les services passés et leurs tickets, pour vérifier ou corriger.",
    href: "/services",
    icon: ClipboardList,
    navKey: "services",
    tone: "bg-violet-50 text-violet-700",
    tile: "tile-violet",
  },
  {
    title: "RH",
    description: "Contrats de travail HCR, clauses et documents employeur.",
    href: "/pilotage/rh",
    icon: Users,
    navKey: "equipe_manage",
    tone: "bg-rose-50 text-rose-700",
    tile: "tile-rose",
    ownerOnly: true,
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
  const visibleTiles = tiles.filter((t) =>
    t.ownerOnly ? isOwner : isOwner || canAccessPage(t.navKey, allowed)
  );

  return (
    <PageContainer>
      <PageHeader
        accentIcon={BarChart3}
        accentTone="bg-blue-50 text-blue-700"
        eyebrow="Espace gestion"
        title="Pilotage"
        subtitle="Les chiffres pour décider : ventes, marges, prévisions d'activité et historique des services."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visibleTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.href}
              href={tile.href}
              title={tile.description}
              className={`group flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl border border-stone-200/60 bg-white p-3 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md ${tile.tile}`}
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tile.tone}`}>
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <span className="line-clamp-2 text-[13px] font-semibold leading-tight tracking-tight text-stone-900">
                {tile.title}
              </span>
            </Link>
          );
        })}
      </div>
    </PageContainer>
  );
}
