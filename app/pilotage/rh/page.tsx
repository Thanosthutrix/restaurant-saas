import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Building2, FileText, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";

const tiles: {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: string;
  tile: string;
}[] = [
  {
    title: "Administratif",
    description: "SIRET, URSSAF, charges, investissements et factures par secteur.",
    href: "/pilotage/rh/administratif",
    icon: Building2,
    tone: "bg-amber-50 text-amber-700",
    tile: "tile-amber",
  },
  {
    title: "Contrats",
    description: "Générer des brouillons de contrats CDI, CDD ou saisonniers avec clauses HCR.",
    href: "/pilotage/rh/contrats",
    icon: FileText,
    tone: "bg-rose-50 text-rose-700",
    tile: "tile-rose",
  },
];

export default async function RhPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await getShellAccessContext(user.id);
  if (!ctx?.currentRestaurant) redirect("/onboarding");
  if (!ctx.isOwner) redirect("/equipe/mon-planning");

  return (
    <PageContainer>
      <PageHeader
        accentIcon={Users}
        accentTone="bg-rose-50 text-rose-700"
        breadcrumbs={[{ label: "Pilotage", href: "/pilotage" }, { label: "RH" }]}
        eyebrow="Espace gestion"
        title="RH"
        subtitle="Ressources humaines : administratif employeur, contrats de travail et documents HCR."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.href}
              href={tile.href}
              title={tile.description}
              className={`group flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl border border-stone-200/60 bg-white p-3 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md ${tile.tile}`}
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tile.tone}`}>
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <span className="line-clamp-2 text-[13px] font-semibold leading-tight tracking-tight text-stone-900">
                {tile.title}
              </span>
            </Link>
          );
        })}
      </div>
    </PageContainer>
  );
}
