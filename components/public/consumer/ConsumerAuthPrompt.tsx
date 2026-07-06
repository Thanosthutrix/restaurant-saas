"use client";

import Link from "next/link";
import { LogIn, UserPlus } from "lucide-react";

type Props = {
  returnPath: string;
};

export function ConsumerAuthPrompt({ returnPath }: Props) {
  const next = encodeURIComponent(returnPath);
  const loginHref = `/compte/connexion?next=${next}`;
  const signupHref = `/compte/inscription?next=${next}`;

  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50/80 p-6 text-center">
      <h3 className="text-lg font-bold text-slate-900">Connectez-vous pour réserver</h3>
      <p className="mt-2 text-sm text-slate-600">
        Créez un compte gratuit pour confirmer votre table, recevoir votre ticket et retrouver vos
        restaurants.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href={loginHref}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
        >
          <LogIn className="h-4 w-4" aria-hidden />
          Se connecter
        </Link>
        <Link
          href={signupHref}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-300 bg-white px-5 py-3 text-sm font-bold text-orange-700 transition hover:bg-orange-50"
        >
          <UserPlus className="h-4 w-4" aria-hidden />
          Créer un compte
        </Link>
      </div>
    </div>
  );
}
