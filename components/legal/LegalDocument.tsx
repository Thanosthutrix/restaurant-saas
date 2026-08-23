import Link from "next/link";
import { PublicLayoutShell } from "@/components/public/PublicLayoutShell";

type Section = {
  title: string;
  paragraphs: string[];
  list?: string[];
};

type Props = {
  title: string;
  updatedAt: string;
  intro: string;
  sections: Section[];
};

export function LegalDocument({ title, updatedAt, intro, sections }: Props) {
  return (
    <PublicLayoutShell headerMode="pro">
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">Ubion</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">{title}</h1>
        <p className="mt-2 text-sm text-stone-500">Dernière mise à jour : {updatedAt}</p>
        <p className="mt-6 text-base leading-relaxed text-stone-700">{intro}</p>

        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold text-stone-900">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-stone-700">
                {section.paragraphs.map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
                {section.list && (
                  <ul className="list-disc space-y-1 pl-5">
                    {section.list.map((item) => (
                      <li key={item.slice(0, 40)}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-12 border-t border-stone-200 pt-6 text-sm text-stone-500">
          Questions :{" "}
          <a href="mailto:contact@ubion.fr" className="font-medium text-orange-700 hover:underline">
            contact@ubion.fr
          </a>
          {" · "}
          <Link href="/legal/terms" className="hover:text-stone-700">
            CGV / CGU
          </Link>
          {" · "}
          <Link href="/legal/privacy" className="hover:text-stone-700">
            Confidentialité
          </Link>
        </p>
      </article>
    </PublicLayoutShell>
  );
}
