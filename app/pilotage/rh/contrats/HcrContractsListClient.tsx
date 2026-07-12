"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileText, Trash2 } from "lucide-react";
import { deleteHcrContractAction } from "./actions";
import type { HcrContractRow } from "@/lib/hcr-contracts/hcrContractsDb";
import { uiBadgeRose, uiBadgeSlate, uiError } from "@/components/ui/premium";

const KIND_LABELS: Record<string, string> = {
  cdi: "CDI",
  cdd: "CDD",
  saisonnier: "Saisonnier",
  extra: "Extra",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  exported: "Exporté",
};

function statusBadge(status: string) {
  return status === "exported" ? uiBadgeRose : uiBadgeSlate;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function HcrContractsListClient({
  restaurantId,
  contracts,
}: {
  restaurantId: string;
  contracts: HcrContractRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function runDelete(contractId: string) {
    if (!window.confirm("Supprimer ce brouillon de contrat ?")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteHcrContractAction({ restaurantId, contractId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error ? <p className={uiError}>{error}</p> : null}
      <ul className="space-y-2">
        {contracts.map((contract) => {
          const employeeName = `${contract.employeeFirstName} ${contract.employeeLastName}`.trim();
          return (
            <li key={contract.id}>
              <div className="group flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white px-3.5 py-3 shadow-sm transition hover:border-rose-200 hover:shadow-md">
                <Link
                  href={`/pilotage/rh/contrats/${contract.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 ring-1 ring-rose-100/90">
                    <FileText className="h-5 w-5 text-rose-700" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-stone-900 transition group-hover:text-rose-800">
                      {contract.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-stone-500">
                      {KIND_LABELS[contract.contractKind] ?? contract.contractKind}
                      {employeeName && employeeName !== "— —" ? ` · ${employeeName}` : ""}
                      {" · "}
                      Modifié le {formatDate(contract.updatedAt)}
                    </span>
                  </span>
                  <span className={`${statusBadge(contract.status)} shrink-0`}>
                    {STATUS_LABELS[contract.status] ?? contract.status}
                  </span>
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => runDelete(contract.id)}
                  className="shrink-0 rounded-xl p-2 text-stone-400 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                  title="Supprimer le brouillon"
                  aria-label={`Supprimer ${contract.title}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
