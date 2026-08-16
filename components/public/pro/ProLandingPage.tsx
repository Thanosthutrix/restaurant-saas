"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Clock3,
  Euro,
  Megaphone,
  Users,
} from "lucide-react";
import { BrandLogo } from "@/components/app/BrandLogo";
import { uiBtnPrimary, uiBtnSecondary } from "@/components/ui/premium";
import {
  PRO_CLOSING,
  PRO_HOOK,
  PRO_PROBLEMS,
  PRO_RESULT,
  PRO_SOLUTIONS,
  type ProSolution,
} from "@/lib/public/proLandingContent";
import { ProAppMockup } from "./ProAppMockups";

const SOLUTION_ICONS = {
  clock: Clock3,
  euro: Euro,
  clipboard: ClipboardList,
  megaphone: Megaphone,
  users: Users,
} as const;

function SolutionBlock({ solution, reverse }: { solution: ProSolution; reverse?: boolean }) {
  const Icon = SOLUTION_ICONS[solution.icon];

  return (
    <section className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={reverse ? "lg:order-2" : ""}>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-copper-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-copper-800">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {solution.tag}
        </div>
        <p className="mb-3 text-sm font-medium text-stone-500">{solution.problem}</p>
        <h3 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">{solution.title}</h3>
        <p className="mt-3 text-base leading-relaxed text-stone-600">{solution.description}</p>
        <ul className="mt-6 space-y-3">
          {solution.features.map((feat) => (
            <li key={feat} className="flex items-start gap-2.5 text-sm text-stone-700">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
              </span>
              {feat}
            </li>
          ))}
        </ul>
      </div>
      <div className={`relative ${reverse ? "lg:order-1" : ""}`}>
        <div
          className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-copper-100/80 via-transparent to-stone-100/50 blur-2xl"
          aria-hidden
        />
        {solution.mock ? (
          <ProAppMockup type={solution.mock} className="relative" />
        ) : (
          <ProAppMockup type="dashboard" className="relative" />
        )}
      </div>
    </section>
  );
}

type Props = {
  isProUser: boolean;
};

export function ProLandingPage({ isProUser }: Props) {
  const primaryHref = isProUser ? "/dashboard" : "/signup";
  const primaryLabel = isProUser ? "Ouvrir l'application" : "Créer mon compte pro";
  const secondaryHref = isProUser ? "/dashboard" : "/login";
  const secondaryLabel = isProUser ? "Tableau de bord" : "Se connecter";

  return (
    <div className="bg-[#0D0B08] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-20 pt-8 sm:px-6 sm:pb-28 sm:pt-12 lg:px-8">
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(200,126,32,0.22)_0%,transparent_68%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-8 flex justify-center">
            <BrandLogo className="h-20 w-auto sm:h-24" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper-400">{PRO_HOOK.eyebrow}</p>
          <h1 className="mt-4 text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            {PRO_HOOK.title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/55 sm:text-lg">{PRO_HOOK.lead}</p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/40">{PRO_HOOK.sub}</p>
          <p className="mt-8 text-lg font-semibold text-copper-300">{PRO_HOOK.punchline}</p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href={primaryHref} className={`${uiBtnPrimary} inline-flex items-center gap-2 px-6 py-3 text-base`}>
              {primaryLabel}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            {!isProUser ? (
              <Link href={secondaryHref} className={`${uiBtnSecondary} px-6 py-3 text-base text-stone-800`}>
                {secondaryLabel}
              </Link>
            ) : null}
          </div>

          {!isProUser ? (
            <p className="mt-6 text-xs text-white/35">
              Déjà client ?{" "}
              <Link href="/login" className="font-semibold text-copper-400 underline-offset-2 hover:underline">
                Connectez-vous à l&apos;espace pro
              </Link>
            </p>
          ) : null}
        </div>
      </section>

      {/* Problems */}
      <section className="bg-stone-950 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-copper-500">Les défis du quotidien</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Cinq problèmes qui épuisent les restaurateurs
            </h2>
          </div>

          <div className="space-y-6">
            {PRO_PROBLEMS.map((problem) => (
              <article
                key={problem.id}
                className="grid gap-6 rounded-3xl border border-white/8 bg-white/[0.03] p-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-10 sm:p-8"
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-copper-500">
                    Défi n°{problem.index}
                  </p>
                  <p className="mt-2 text-5xl font-bold tabular-nums tracking-tight text-white sm:text-6xl">
                    {problem.stat}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/45">{problem.statSub}</p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white sm:text-2xl">{problem.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/50">{problem.description}</p>
                  {problem.bullets?.length ? (
                    <ul className="mt-4 space-y-2">
                      {problem.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-sm text-white/40">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper-500" aria-hidden />
                          {b}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-3xl border border-rose-500/20 bg-rose-500/10 p-8 text-center sm:p-10">
            <p className="text-5xl font-bold tabular-nums text-white sm:text-6xl">{PRO_RESULT.stat}</p>
            <p className="mt-2 text-sm text-rose-200/70">{PRO_RESULT.statSub}</p>
            <h3 className="mt-6 text-xl font-semibold text-white">{PRO_RESULT.title}</h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/55">{PRO_RESULT.description}</p>
          </div>
        </div>
      </section>

      {/* Transition */}
      <section className="copper-sheen px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Et si tout ça avait une solution ?</p>
        <h2 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">Voici Ubion.</h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/85">
          La première application qui réunit tout ce dont un restaurateur a besoin pour reprendre le contrôle — du
          stock à la salle, de la cuisine à l&apos;image, des équipes aux finances.
        </p>
      </section>

      {/* Solutions */}
      <section className="bg-[#FAFAF8] px-4 py-16 text-stone-900 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-20 sm:space-y-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-copper-700">Les solutions</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Chaque problème a sa réponse — concrète, mesurable
            </h2>
          </div>

          {PRO_SOLUTIONS.map((solution, i) => (
            <SolutionBlock key={solution.id} solution={solution} reverse={i % 2 === 1} />
          ))}
        </div>
      </section>

      {/* App preview strip */}
      <section className="border-y border-stone-200 bg-white px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-copper-700">Aperçu de l&apos;application</p>
            <h2 className="mt-3 text-2xl font-bold text-stone-900 sm:text-3xl">Tout votre restaurant, dans une seule interface</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <ProAppMockup type="dashboard" />
            <ProAppMockup type="stock" />
            <ProAppMockup type="floor" />
            <ProAppMockup type="recipe" />
            <ProAppMockup type="reservations" />
            <ProAppMockup type="haccp" />
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(200,126,32,0.15)_0%,transparent_70%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <BrandLogo className="mx-auto h-16 w-auto" />
          <h2 className="mt-8 text-3xl font-bold tracking-tight sm:text-4xl">{PRO_CLOSING.title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/55">{PRO_CLOSING.lead}</p>
          <p className="mt-6 text-lg font-semibold text-copper-300">{PRO_CLOSING.tagline}</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href={primaryHref} className={`${uiBtnPrimary} inline-flex items-center gap-2 px-6 py-3 text-base`}>
              {primaryLabel}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/" className="text-sm font-semibold text-white/50 transition hover:text-white/80">
              Retour à l&apos;annuaire public
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
