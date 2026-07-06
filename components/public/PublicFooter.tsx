import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-900 text-slate-300">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-semibold text-white">ubion · Portail clients</p>
          <p className="mt-1 text-sm text-slate-400">
            Réservations en direct, avis certifiés et scores d&apos;hygiène officiels.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/" className="transition hover:text-white">
            Annuaire
          </Link>
          <Link href="/login" className="transition hover:text-white">
            Connexion restaurateur
          </Link>
        </div>
      </div>
    </footer>
  );
}
