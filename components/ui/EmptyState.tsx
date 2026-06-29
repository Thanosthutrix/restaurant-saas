import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { uiBtnPrimary } from "@/components/ui/premium";

/**
 * État vide qui guide au lieu d'être un cul-de-sac : icône, titre clair,
 * explication courte, et une action concrète quand elle existe.
 * Remplace les « Aucun X. » en texte brut.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  actionIcon: ActionIcon,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  /** Raccourci pour une action principale (bouton cuivre). */
  actionLabel?: string;
  actionHref?: string;
  /** Icône optionnelle dans le bouton d'action (ex. Plus pour « créer »). */
  actionIcon?: LucideIcon;
  /** Action personnalisée (remplace actionLabel/actionHref). */
  action?: React.ReactNode;
  /** Variante resserrée pour les zones intégrées (panneaux, colonnes). */
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-2xl border border-stone-200/70 bg-white text-center ${
        compact ? "px-4 py-6" : "px-6 py-10"
      }`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-copper-50">
        <Icon className="h-6 w-6 text-copper-800" aria-hidden />
      </div>
      <p className="mt-3 text-base font-semibold text-stone-900">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-stone-500">{description}</p>
      ) : null}
      {action ? (
        <div className="mt-4">{action}</div>
      ) : actionLabel && actionHref ? (
        <Link href={actionHref} className={`${uiBtnPrimary} mt-4 inline-flex items-center gap-1.5`}>
          {ActionIcon ? <ActionIcon className="h-4 w-4" aria-hidden /> : null}
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
