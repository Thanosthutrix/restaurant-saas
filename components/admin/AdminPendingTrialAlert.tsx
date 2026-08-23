import Link from "next/link";
import { AlertCircle, ArrowRight, FlaskConical } from "lucide-react";
import type { ProTrialRequestRow } from "@/lib/pro/trialRequestDb";

type Props = {
  count: number;
  requests?: ProTrialRequestRow[];
  variant?: "banner" | "card";
};

function formatWhen(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminPendingTrialAlert({ count, requests = [], variant = "banner" }: Props) {
  if (count <= 0) return null;

  const label = count === 1 ? "1 demande d'essai en attente" : `${count} demandes d'essai en attente`;

  if (variant === "banner") {
    return (
      <div
        className="border-b border-amber-300 bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-white shadow-md"
        role="alert"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
              <AlertCircle className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-semibold">{label}</p>
              <p className="text-sm text-amber-50">Action requise — approuvez ou refusez l&apos;essai Pro.</p>
            </div>
          </div>
          <Link
            href="/admin/trial-requests"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-orange-700 shadow-sm transition hover:bg-amber-50"
          >
            Traiter maintenant
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 overflow-hidden rounded-xl border-2 border-amber-400 bg-amber-50 shadow-sm ring-4 ring-amber-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-100/80 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white">
            <FlaskConical className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-lg font-bold text-amber-950">{label}</p>
            <p className="text-sm text-amber-800">Ces restaurateurs attendent votre validation pour démarrer.</p>
          </div>
        </div>
        <Link
          href="/admin/trial-requests"
          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
        >
          Voir et traiter
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      {requests.length > 0 && (
        <ul className="divide-y divide-amber-100 bg-white/60">
          {requests.map((r) => (
            <li key={r.id}>
              <Link
                href="/admin/trial-requests"
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm transition hover:bg-white"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {r.restaurant_name ?? "Établissement non renseigné"}
                  </p>
                  <p className="text-gray-500">{r.contact_email}</p>
                </div>
                <span className="text-xs font-medium text-amber-700">{formatWhen(r.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
