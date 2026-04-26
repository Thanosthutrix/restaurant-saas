import Link from "next/link";
import { ArrowUpRight, ClipboardList, Droplets, Package, Percent, UtensilsCrossed } from "lucide-react";
import { uiCard, uiLead, uiPageTitle } from "@/components/ui/premium";

const actions = [
  {
    title: "Préparer un service",
    description: "Créer ou reprendre un service, puis saisir les ventes pour garder le stock et les marges à jour.",
    href: "/service/new",
    icon: ClipboardList,
    tone: "bg-indigo-50 text-indigo-700",
  },
  {
    title: "Fiches plats",
    description: "Recettes, composants et prix de vente : la base pour calculer les coûts matière.",
    href: "/dishes",
    icon: UtensilsCrossed,
    tone: "bg-violet-50 text-violet-700",
  },
  {
    title: "Préparations",
    description: "Productions maison et sous-recettes utilisées dans les plats.",
    href: "/preparations",
    icon: Package,
    tone: "bg-sky-50 text-sky-700",
  },
  {
    title: "Stock cuisine",
    description: "Contrôler les niveaux, repérer les manques et préparer les prochains achats.",
    href: "/inventory",
    icon: Package,
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    title: "Marges",
    description: "Vérifier les marges réelles après achats, BL et factures fournisseurs.",
    href: "/margins",
    icon: Percent,
    tone: "bg-amber-50 text-amber-700",
  },
  {
    title: "Hygiène",
    description: "Suivre les tâches de nettoyage et les contrôles HACCP depuis la cuisine.",
    href: "/hygiene",
    icon: Droplets,
    tone: "bg-cyan-50 text-cyan-700",
  },
];

export default function CuisinePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Espace métier</p>
        <h1 className={`${uiPageTitle} mt-2`}>Cuisine</h1>
        <p className={`${uiLead} mt-2 max-w-2xl`}>
          Tout ce qui sert au chef est regroupé ici, dans l’ordre logique : préparer le service, gérer les fiches,
          surveiller le stock, puis contrôler les marges et l’hygiène.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Actions cuisine">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href} className={`${uiCard} group block transition hover:-translate-y-0.5 hover:shadow-md`}>
              <div className="flex items-start justify-between gap-4">
                <div className={`rounded-2xl p-3 ${action.tone}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <ArrowUpRight className="h-5 w-5 text-slate-300 transition group-hover:text-indigo-500" aria-hidden />
              </div>
              <h2 className="mt-4 text-base font-semibold text-slate-900">{action.title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{action.description}</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
