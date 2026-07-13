import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  headerGradient?: string;
  iconClassName?: string;
  children: React.ReactNode;
  className?: string;
};

export function PublicInfoPanel({
  icon: Icon,
  title,
  subtitle,
  badge,
  headerGradient = "from-orange-50 to-white",
  iconClassName = "bg-orange-100 text-orange-600",
  children,
  className = "",
}: Props) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <div className={`border-b border-slate-100 bg-gradient-to-r px-5 py-4 ${headerGradient}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900">{title}</h3>
              {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
            </div>
          </div>
          {badge}
        </div>
      </div>
      {children}
    </section>
  );
}
