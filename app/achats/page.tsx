import Link from "next/link";
import { ArrowRight, ArrowUpRight, ClipboardCheck, FileText, Package, Sparkles, Truck } from "lucide-react";
import { uiCard, uiLead, uiPageTitle } from "@/components/ui/premium";

const flow = [
  {
    title: "1. Voir les besoins",
    description: "Les suggestions partent du stock et aident à préparer les commandes fournisseurs.",
    href: "/orders/suggestions",
    cta: "Ouvrir les suggestions",
  },
  {
    title: "2. Envoyer la commande",
    description: "Commandes préparées ou manuelles, avec envoi fournisseur par email, WhatsApp ou SMS.",
    href: "/orders",
    cta: "Voir les commandes",
  },
  {
    title: "3. Pointer la réception",
    description: "Les BL attendus sont prêts dans livraison pour contrôler quantités et prix reçus.",
    href: "/livraison",
    cta: "Pointer les BL",
  },
  {
    title: "4. Rapprocher la facture",
    description: "Comparer facture, BL et tarifs pour valider les écarts avant export comptable.",
    href: "/supplier-invoices",
    cta: "Gérer les factures",
  },
];

const shortcuts = [
  { label: "Stock", href: "/inventory", icon: Package },
  { label: "Fournisseurs", href: "/suppliers", icon: Truck },
  { label: "Suggestions d’achat", href: "/orders/suggestions", icon: Sparkles },
  { label: "Commandes fournisseurs", href: "/orders", icon: ClipboardCheck },
  { label: "Réceptions / BL", href: "/livraison", icon: Package },
  { label: "Factures fournisseurs", href: "/supplier-invoices", icon: FileText },
];

export default function AchatsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Espace métier</p>
        <h1 className={`${uiPageTitle} mt-2`}>Achats & stock</h1>
        <p className={`${uiLead} mt-2 max-w-2xl`}>
          Le parcours achat est regroupé au même endroit : besoin, commande, réception, facture, puis transfert
          comptable.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-4" aria-label="Parcours achats">
        {flow.map((step, index) => (
          <Link key={step.href} href={step.href} className={`${uiCard} group block transition hover:-translate-y-0.5 hover:shadow-md`}>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">
                {index + 1}
              </span>
              <ArrowUpRight className="h-5 w-5 text-slate-300 transition group-hover:text-indigo-500" aria-hidden />
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-900">{step.title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{step.description}</p>
            <p className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600">
              {step.cta}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </p>
          </Link>
        ))}
      </section>

      <section className={uiCard} aria-labelledby="shortcuts-heading">
        <h2 id="shortcuts-heading" className="text-sm font-semibold text-slate-900">
          Accès rapides achats
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((shortcut) => {
            const Icon = shortcut.icon;
            return (
              <Link
                key={shortcut.href}
                href={shortcut.href}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-100 hover:bg-white hover:text-indigo-700"
              >
                <span className="inline-flex items-center gap-3">
                  <Icon className="h-4 w-4 text-slate-400" aria-hidden />
                  {shortcut.label}
                </span>
                <ArrowUpRight className="h-4 w-4 text-slate-300" aria-hidden />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
