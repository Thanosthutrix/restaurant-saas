import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { uiLead, uiPageTitle } from "@/components/ui/premium";

export type Breadcrumb = { label: string; href?: string };

/**
 * Conteneur de page unifié. Largeur cohérente sur toute l'app (2 tokens).
 * Le padding horizontal et vertical est fourni par le <main> du shell —
 * ici on ne gère que la largeur max et le rythme vertical.
 */
export function PageContainer({
  width = "wide",
  children,
}: {
  width?: "wide" | "narrow";
  children: React.ReactNode;
}) {
  const max = width === "narrow" ? "max-w-3xl" : "max-w-6xl";
  return <div className={`mx-auto w-full min-w-0 ${max} space-y-8`}>{children}</div>;
}

/**
 * En-tête de page unifié : fil d'ariane (ou eyebrow), titre, sous-titre,
 * et un emplacement d'action aligné à droite. Remplace les en-têtes
 * recodés à la main et le « ← Tableau de bord » redondant (le header
 * global porte déjà le bouton « Retour »).
 */
export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  eyebrow,
  actions,
  accentIcon: AccentIcon,
  accentTone,
}: {
  title: string;
  subtitle?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  eyebrow?: string;
  actions?: React.ReactNode;
  /** Identité couleur de la section : pictogramme affiché à gauche du titre. */
  accentIcon?: LucideIcon;
  /** Classes du carré d'accent (fond + texte), ex. "bg-cyan-50 text-cyan-700". */
  accentTone?: string;
}) {
  return (
    <header className="space-y-2">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-copper-700">{eyebrow}</p>
      ) : breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Fil d'ariane" className="flex flex-wrap items-center gap-1 text-xs text-stone-400">
          {breadcrumbs.map((c, i) => {
            const last = i === breadcrumbs.length - 1;
            return (
              <span key={`${c.label}-${i}`} className="flex items-center gap-1">
                {c.href && !last ? (
                  <Link href={c.href} className="transition hover:text-copper-700">
                    {c.label}
                  </Link>
                ) : (
                  <span className={last ? "text-stone-600" : undefined}>{c.label}</span>
                )}
                {!last ? <ChevronRight className="h-3.5 w-3.5 text-stone-300" aria-hidden /> : null}
              </span>
            );
          })}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          {AccentIcon ? (
            <span
              className={`hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:flex ${
                accentTone ?? "bg-copper-50 text-copper-700"
              }`}
            >
              <AccentIcon className="h-6 w-6" aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className={uiPageTitle}>{title}</h1>
            {subtitle ? <p className={`mt-2 ${uiLead}`}>{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
