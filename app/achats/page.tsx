import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Boxes, ClipboardCheck, FileText, PackageCheck, Sparkles, Truck } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import {
  getInventoryStockDashboardSummary,
  getRecentDeliveryNotesForRestaurant,
  getSupplierInvoicesForRestaurant,
} from "@/lib/db";
import { cachedGetSuppliers } from "@/lib/cache";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { SECTION_ACCENT } from "@/lib/ui/sectionAccents";

export default async function AchatsPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [summaryRes, suppliersRes, notesRes, invoicesRes] = await Promise.all([
    getInventoryStockDashboardSummary(restaurant.id),
    cachedGetSuppliers(restaurant.id, true),
    getRecentDeliveryNotesForRestaurant(restaurant.id, 200),
    getSupplierInvoicesForRestaurant(restaurant.id, { includeFileFields: false }),
  ]);

  const belowMin = summaryRes.data?.belowMinStockCount ?? 0;
  const inventoryCount = summaryRes.data?.inventoryCount ?? 0;
  const suppliersCount = suppliersRes.data?.length ?? 0;
  const blToPoint = (notesRes.data ?? []).filter((n) => n.status === "draft").length;
  const invoicesToProcess = (invoicesRes.data ?? []).filter((i) => i.status !== "reviewed").length;

  const stats: { label: string; value: number; icon: LucideIcon; tone: string; emphasis?: boolean }[] = [
    {
      label: "Stock sous le mini",
      value: belowMin,
      icon: AlertTriangle,
      tone: belowMin > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700",
      emphasis: belowMin > 0,
    },
    { label: "BL à pointer", value: blToPoint, icon: PackageCheck, tone: blToPoint > 0 ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600" },
    { label: "Factures à traiter", value: invoicesToProcess, icon: FileText, tone: invoicesToProcess > 0 ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600" },
    { label: "Fournisseurs actifs", value: suppliersCount, icon: Truck, tone: "bg-sky-50 text-sky-700" },
  ];

  const shortcuts: { label: string; href: string; icon: LucideIcon; tone: string; tile: string; badge?: number }[] = [
    { label: "Stock", href: "/inventory", icon: Boxes, tone: "bg-emerald-50 text-emerald-700", tile: "tile-emerald", badge: belowMin },
    { label: "Fournisseurs", href: "/suppliers", icon: Truck, tone: "bg-sky-50 text-sky-700", tile: "tile-sky" },
    { label: "Suggestions d’achat", href: "/orders/suggestions", icon: Sparkles, tone: "bg-amber-50 text-amber-700", tile: "tile-amber" },
    { label: "Commandes", href: "/orders", icon: ClipboardCheck, tone: "bg-violet-50 text-violet-700", tile: "tile-violet" },
    { label: "Réceptions / BL", href: "/livraison", icon: PackageCheck, tone: "bg-cyan-50 text-cyan-700", tile: "tile-cyan", badge: blToPoint },
    { label: "Factures", href: "/supplier-invoices", icon: FileText, tone: "bg-copper-50 text-copper-700", tile: "tile-copper", badge: invoicesToProcess },
  ];

  return (
    <PageContainer>
      <PageHeader
        accentIcon={SECTION_ACCENT.achats.icon}
        accentTone={SECTION_ACCENT.achats.tone}
        eyebrow="Espace métier"
        title="Achats & stock"
        subtitle="Tout le parcours achat au même endroit : besoin, commande, réception, facture — et un coup d’œil sur ce qui réclame votre attention."
      />

      {/* Chiffres clés */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Synthèse achats">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={`flex items-center gap-3 rounded-2xl border p-3 shadow-sm sm:p-4 ${
                s.emphasis ? "border-rose-200 bg-rose-50/60" : "border-stone-200/70 bg-white"
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.tone}`}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-semibold tabular-nums leading-none tracking-tight text-stone-900">
                  {s.value}
                </p>
                <p className="mt-1 text-xs font-medium text-stone-500">{s.label}</p>
              </div>
            </div>
          );
        })}
      </section>

      {/* Accès rapides */}
      <section aria-label="Accès rapides">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {shortcuts.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.href}
                href={s.href}
                className={`group relative flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl border border-stone-200/60 bg-white p-3 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md ${s.tile}`}
              >
                {s.badge && s.badge > 0 ? (
                  <span className="absolute right-2 top-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white">
                    {s.badge > 99 ? "99+" : s.badge}
                  </span>
                ) : null}
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${s.tone}`}>
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <span className="line-clamp-2 text-[13px] font-semibold leading-tight tracking-tight text-stone-900">
                  {s.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <p className="text-xs text-stone-400">{inventoryCount} composant(s) suivis en stock.</p>
    </PageContainer>
  );
}
