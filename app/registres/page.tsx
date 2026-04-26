import Link from "next/link";
import { ArrowUpRight, CalendarDays, ClipboardList, Droplets, FileText, History, Users } from "lucide-react";
import { uiCard, uiLead, uiPageTitle } from "@/components/ui/premium";

const registers = [
  {
    title: "Historique des services",
    description: "Tickets, ventes et services passés.",
    href: "/services",
    icon: History,
  },
  {
    title: "Réceptions / BL",
    description: "Bons de livraison reçus ou en attente de rapprochement facture.",
    href: "/livraison",
    icon: ClipboardList,
  },
  {
    title: "Factures fournisseurs",
    description: "Factures importées, contrôlées et prêtes pour la comptabilité.",
    href: "/supplier-invoices",
    icon: FileText,
  },
  {
    title: "Hygiène",
    description: "Registre de nettoyage et contrôles HACCP.",
    href: "/hygiene",
    icon: Droplets,
  },
  {
    title: "Calendrier",
    description: "Événements, météo et repères d’activité.",
    href: "/insights/calendar",
    icon: CalendarDays,
  },
  {
    title: "Clients",
    description: "Base clients et réservations associées.",
    href: "/clients",
    icon: Users,
  },
];

export default function RegistresPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Recherche & contrôle</p>
        <h1 className={`${uiPageTitle} mt-2`}>Registres</h1>
        <p className={`${uiLead} mt-2 max-w-2xl`}>
          Un point d’accès unique pour retrouver les historiques, justificatifs et registres utiles au suivi du
          restaurant.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Registres disponibles">
        {registers.map((register) => {
          const Icon = register.icon;
          return (
            <Link key={register.href} href={register.href} className={`${uiCard} group block transition hover:-translate-y-0.5 hover:shadow-md`}>
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-2xl bg-slate-50 p-3 text-slate-600">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <ArrowUpRight className="h-5 w-5 text-slate-300 transition group-hover:text-indigo-500" aria-hidden />
              </div>
              <h2 className="mt-4 text-base font-semibold text-slate-900">{register.title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{register.description}</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
