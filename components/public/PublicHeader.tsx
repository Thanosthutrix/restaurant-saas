import Link from "next/link";
import { MapPin, UtensilsCrossed } from "lucide-react";
import { ConsumerAccountNav } from "@/components/public/consumer/ConsumerAccountNav";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/25">
            <UtensilsCrossed className="h-5 w-5" aria-hidden />
          </span>
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-tight text-slate-900">ubion</p>
            <p className="hidden text-xs text-slate-500 sm:block">Trouvez · Réservez · Savourez</p>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
          >
            <MapPin className="h-4 w-4" aria-hidden />
            Annuaire
          </Link>
          <ConsumerAccountNav />
          <Link
            href="/login"
            className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:inline-flex"
          >
            Espace pro
          </Link>
        </nav>
      </div>
    </header>
  );
}
