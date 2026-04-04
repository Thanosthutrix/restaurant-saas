import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getService, getServiceSalesWithDishes } from "@/lib/db";
import { DeleteServiceButton } from "./DeleteServiceButton";

type Props = { params: Promise<{ id: string }> };

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatServiceType(type: string) {
  return type === "lunch" ? "Déjeuner" : "Dîner";
}

export default async function ServiceDetailPage({ params }: Props) {
  const { id } = await params;

  const [serviceResult, salesResult] = await Promise.all([
    getService(id),
    getServiceSalesWithDishes(id),
  ]);

  if (serviceResult.error || !serviceResult.data) {
    notFound();
  }

  const service = serviceResult.data;
  const sales = salesResult.data ?? [];
  const stockImpact = service.stock_impact_json;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6">
          <Link
            href="/services"
            className="text-slate-600 underline decoration-slate-400 underline-offset-2"
          >
            ← Historique des services
          </Link>
        </div>

        <h1 className="mb-6 text-xl font-semibold text-slate-900">
          Fiche service
        </h1>

        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-slate-900">
            <span className="font-medium">Date :</span> {formatDate(service.service_date)}
          </p>
          <p className="mt-1 text-slate-900">
            <span className="font-medium">Type :</span> {formatServiceType(service.service_type)}
          </p>
        </div>

        {service.image_url && (
          <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-medium text-slate-500">
              Ticket (relevé de caisse)
            </h2>
            <div className="relative aspect-[3/4] max-w-sm overflow-hidden rounded border border-slate-200">
              <Image
                src={service.image_url}
                alt="Photo du ticket de caisse"
                fill
                className="object-contain"
                unoptimized
                sizes="(max-width: 768px) 100vw, 28rem"
              />
            </div>
          </section>
        )}

        {service.analysis_error && (
          <div className="mb-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Erreur d&apos;analyse : {service.analysis_error}
          </div>
        )}

        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-500">
            Ventes enregistrées
          </h2>
          {sales.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune vente.</p>
          ) : (
            <ul className="space-y-1 text-sm text-slate-700">
              {sales.map((s) => (
                <li key={s.id}>
                  <strong>{(s.dishes as { name: string } | null)?.name ?? s.dish_id}</strong> × {s.qty}
                </li>
              ))}
            </ul>
          )}
        </section>

        {stockImpact != null && (
          <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-500">
              Impact sur le stock
            </h2>
            <p className="text-sm text-slate-700">
              {stockImpact.applied_count} plat{stockImpact.applied_count !== 1 ? "s" : ""} ont décrementé le stock.
              {stockImpact.skipped_count > 0 && (
                <span className="block mt-1 text-amber-700">
                  {stockImpact.skipped_count} plat{stockImpact.skipped_count !== 1 ? "s" : ""} sans recette exploitable (non décomptés).
                </span>
              )}
            </p>
            {stockImpact.warnings.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-slate-500">
                {stockImpact.warnings.slice(0, 5).map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
                {stockImpact.warnings.length > 5 && (
                  <li>… et {stockImpact.warnings.length - 5} autre(s) avertissement(s).</li>
                )}
              </ul>
            )}
            <p className="mt-3">
              <Link
                href={`/service/${id}/stock`}
                className="text-sm text-slate-600 underline"
              >
                Voir le détail consommation théorique
              </Link>
            </p>
          </section>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/services"
            className="text-slate-600 underline decoration-slate-400 underline-offset-2"
          >
            Historique des services
          </Link>
          <Link
            href="/dashboard"
            className="text-slate-600 underline decoration-slate-400 underline-offset-2"
          >
            Tableau de bord
          </Link>
          <span className="ml-auto">
            <DeleteServiceButton serviceId={service.id} />
          </span>
        </div>
      </div>
    </div>
  );
}
