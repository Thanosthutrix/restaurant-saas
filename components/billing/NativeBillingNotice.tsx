"use client";

import { ExternalLink, Mail } from "lucide-react";
import { isNativeApp } from "@/lib/capacitor/platform";

const WEB_ORIGIN =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")) ||
  "https://www.ubion.fr";

type Context = "signup" | "manage" | "blocked";

const COPY: Record<
  Context,
  { title: string; body: string; webPath: string; webLabel: string }
> = {
  signup: {
    title: "Abonnement sur le site web",
    body: "Pour vous abonner à Ubion Pro, utilisez ubion.fr dans Safari ou Chrome. Vous pouvez aussi demander un essai gratuit ci-dessous.",
    webPath: "/onboarding/start",
    webLabel: "Ouvrir ubion.fr",
  },
  manage: {
    title: "Gérer l'abonnement sur le web",
    body: "La modification de l'abonnement, des moyens de paiement et des factures se fait sur votre espace ubion.fr (navigateur).",
    webPath: "/settings/billing",
    webLabel: "Gérer sur ubion.fr",
  },
  blocked: {
    title: "Réactiver votre accès",
    body: "Pour renouveler ou souscrire à Ubion Pro, connectez-vous sur ubion.fr depuis un navigateur, ou contactez notre équipe.",
    webPath: "/settings/billing",
    webLabel: "Aller sur ubion.fr",
  },
};

type Props = {
  context?: Context;
  /** Force l'affichage (SSR ne connaît pas Capacitor). */
  forceShow?: boolean;
  className?: string;
};

export function NativeBillingNotice({ context = "manage", forceShow = false, className = "" }: Props) {
  if (!forceShow && !isNativeApp()) return null;

  const copy = COPY[context];
  const webUrl = `${WEB_ORIGIN}${copy.webPath}`;

  return (
    <div
      className={`rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-950 ${className}`}
    >
      <p className="font-semibold">{copy.title}</p>
      <p className="mt-1 leading-relaxed text-sky-900/90">{copy.body}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <a
          href={webUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-sky-900 shadow-sm ring-1 ring-sky-200 transition hover:bg-sky-50"
        >
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
          {copy.webLabel}
        </a>
        <a
          href="mailto:contact@ubion.fr?subject=Abonnement%20Ubion%20Pro"
          className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sky-800 underline-offset-2 hover:underline"
        >
          <Mail className="h-4 w-4 shrink-0" aria-hidden />
          contact@ubion.fr
        </a>
      </div>
    </div>
  );
}
