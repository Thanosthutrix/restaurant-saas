import type { LucideIcon } from "lucide-react";
import { uiCard, uiLead, uiSectionTitle } from "@/components/ui/premium";

type Props = {
  icon: LucideIcon;
  iconTone?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
};

export function EstablishmentSection({
  icon: Icon,
  iconTone = "bg-copper-50 text-copper-700 ring-copper-100",
  title,
  subtitle,
  actions,
  children,
  className = "",
  id,
}: Props) {
  return (
    <section id={id} className={`${uiCard} ${className}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-stone-100 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${iconTone}`}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className={uiSectionTitle}>{title}</h2>
            {subtitle ? <p className={`mt-1 max-w-2xl ${uiLead}`}>{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
