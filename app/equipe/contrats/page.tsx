import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { uiBackLink, uiBtnPrimary, uiCard, uiLead, uiPageTitle } from "@/components/ui/premium";

export const dynamic = "force-dynamic";

export default async function HcrContractsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await getShellAccessContext(user.id);
  if (!ctx?.currentRestaurant) redirect("/onboarding");
  if (!ctx.isOwner) redirect("/equipe/mon-planning");

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <Link href="/equipe" className={uiBackLink}>
        ← Retour à l&apos;équipe
      </Link>

      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">LegalTech RH</p>
          <h1 className={`mt-2 ${uiPageTitle}`}>Générateur de contrats de travail HCR</h1>
          <p className={`mt-2 max-w-3xl ${uiLead}`}>
            Préparez des brouillons de contrats CDI, CDD ou saisonniers avec clauses HCR et export PDF.
          </p>
        </div>
        <Link href="/equipe/contrats/nouveau" className={uiBtnPrimary}>
          Nouveau contrat
        </Link>
      </section>

      <section className={uiCard}>
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-indigo-50 p-3 text-indigo-700">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Assistant employeur</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Cette première version génère un document à partir d&apos;un wizard et d&apos;une bibliothèque de clauses. Les
              brouillons ne sont pas encore historisés en base : utilisez l&apos;export PDF / impression après validation.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
