import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ClipboardList, Droplets, Package, Percent, UtensilsCrossed } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { getInventoryStockDashboardSummary } from "@/lib/db";
import { cachedCountHygienePending, cachedCountPreparations2hSignals } from "@/lib/cache";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";

type Action = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Carré d'icône (fond + texte). */
  tone: string;
  /** Bordure colorée au survol (identité couleur de la rubrique). */
  hover: string;
};

const actions: Action[] = [
  {
    title: "Préparer un service",
    description: "Créer ou reprendre un service, puis saisir les ventes pour garder le stock et les marges à jour.",
    href: "/service/new",
    icon: ClipboardList,
    tone: "bg-copper-50 text-copper-700",
    hover: "tile-copper",
  },
  {
    title: "Fiches plats",
    description: "Recettes, composants et prix de vente : la base pour calculer les coûts matière.",
    href: "/dishes",
    icon: UtensilsCrossed,
    tone: "bg-violet-50 text-violet-700",
    hover: "tile-violet",
  },
  {
    title: "Préparations",
    description: "Productions maison et sous-recettes utilisées dans les plats.",
    href: "/preparations",
    icon: Package,
    tone: "bg-sky-50 text-sky-700",
    hover: "tile-sky",
  },
  {
    title: "Stock cuisine",
    description: "Contrôler les niveaux, repérer les manques et préparer les prochains achats.",
    href: "/inventory",
    icon: Package,
    tone: "bg-emerald-50 text-emerald-700",
    hover: "tile-emerald",
  },
  {
    title: "Marges",
    description: "Vérifier les marges réelles après achats, BL et factures fournisseurs.",
    href: "/margins",
    icon: Percent,
    tone: "bg-amber-50 text-amber-700",
    hover: "tile-amber",
  },
  {
    title: "Hygiène",
    description: "Suivre les tâches de nettoyage et les contrôles HACCP depuis la cuisine.",
    href: "/hygiene",
    icon: Droplets,
    tone: "bg-cyan-50 text-cyan-700",
    hover: "tile-cyan",
  },
];

const BADGE_TONE = {
  copper: "bg-copper-100 text-copper-800",
  amber: "bg-amber-100 text-amber-900",
  rose: "bg-rose-600 text-white",
  blue: "bg-sky-500 text-white",
} as const;

export default async function CuisinePage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [hygienePending, stockRes, prepSignals] = await Promise.all([
    cachedCountHygienePending(restaurant.id).catch(() => 0),
    getInventoryStockDashboardSummary(restaurant.id),
    cachedCountPreparations2hSignals(restaurant.id).catch(() => ({ reminder: 0, overdue: 0 })),
  ]);
  const belowMin = stockRes?.data?.belowMinStockCount ?? 0;
  const prepBadge =
    prepSignals.overdue > 0
      ? { count: prepSignals.overdue, tone: "rose" as const, label: "en retard" }
      : prepSignals.reminder > 0
        ? { count: prepSignals.reminder, tone: "blue" as const, label: "à relever" }
        : null;

  const badges: Record<string, { text: string; title: string; tone: keyof typeof BADGE_TONE } | undefined> = {
    "/hygiene":
      hygienePending > 0
        ? {
            text: hygienePending > 99 ? "99+" : String(hygienePending),
            title: `${hygienePending} tâche(s) d’hygiène à faire`,
            tone: "copper",
          }
        : undefined,
    "/inventory":
      belowMin > 0
        ? { text: String(belowMin), title: `${belowMin} produit(s) sous le seuil`, tone: "amber" }
        : undefined,
    "/preparations": prepBadge
      ? {
          text: prepBadge.count > 99 ? "99+" : String(prepBadge.count),
          title: `${prepBadge.count} préparation(s) — contrôle +2 h ${prepBadge.label}`,
          tone: prepBadge.tone,
        }
      : undefined,
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Espace métier"
        title="Cuisine"
        subtitle="Tout ce qui sert au chef est regroupé ici, dans l’ordre logique : préparer le service, gérer les fiches, surveiller le stock, puis contrôler les marges et l’hygiène."
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Actions cuisine">
        {actions.map((action) => {
          const Icon = action.icon;
          const badge = badges[action.href];
          return (
            <Link
              key={action.href}
              href={action.href}
              title={action.description}
              className={`group relative flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl border border-stone-200/60 bg-white p-3 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md ${action.hover}`}
            >
              {badge ? (
                <span
                  title={badge.title}
                  className={`absolute right-2 top-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[11px] font-bold ${BADGE_TONE[badge.tone]}`}
                >
                  {badge.text}
                </span>
              ) : null}
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${action.tone}`}>
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <span className="line-clamp-2 text-[13px] font-semibold leading-tight tracking-tight text-stone-900">
                {action.title}
              </span>
            </Link>
          );
        })}
      </section>
    </PageContainer>
  );
}
