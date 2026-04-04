import Link from "next/link";
import { uiBtnPrimary, uiBtnSecondary } from "@/components/ui/premium";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <main className="flex w-full max-w-md flex-col items-center gap-10 py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Pilotage quotidien
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Restaurant SaaS</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Services, plats, stock, fournisseurs et indicateurs — au même endroit.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Link href="/login" className={`${uiBtnPrimary} flex h-12 items-center justify-center`}>
            Se connecter
          </Link>
          <Link href="/signup" className={`${uiBtnSecondary} flex h-12 items-center justify-center`}>
            Créer un compte
          </Link>
        </div>
      </main>
    </div>
  );
}
