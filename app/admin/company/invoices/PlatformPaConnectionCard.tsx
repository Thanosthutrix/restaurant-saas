"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Zap } from "lucide-react";
import { startPlatformPaOAuthAction, syncPlatformPaInvoicesAction } from "../paActions";

type Props = {
  connection: {
    enrollmentStatus: string;
    companyVerificationStatus: string | null;
    lastInvoiceReceivedAt: string | null;
    lastError: string | null;
  } | null;
};

const STATUS_LABEL: Record<string, string> = {
  not_enrolled: "Non connecté",
  pending: "Connexion en cours…",
  active: "Connecté",
  error: "Erreur",
};

export function PlatformPaConnectionCard({ connection }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const status = connection?.enrollmentStatus ?? "not_enrolled";

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Réception factures électroniques (Super PDP)
          </p>
          <p className="text-xs text-gray-500">
            {STATUS_LABEL[status] ?? status}
            {connection?.companyVerificationStatus === "needs_review"
              ? " · vérification KYB en cours"
              : ""}
            {connection?.lastInvoiceReceivedAt
              ? ` · dernière synchro : ${new Date(connection.lastInvoiceReceivedAt).toLocaleString("fr-FR")}`
              : ""}
            {" · réception + émission"}
          </p>
          {connection?.lastError ? (
            <p className="mt-1 text-xs text-red-600">{connection.lastError}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          {status === "active" ? (
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  const res = await syncPlatformPaInvoicesAction();
                  if (!res.ok) setMessage(res.error);
                  else
                    setMessage(
                      `${res.data!.fetched} lue(s), ${res.data!.created} importée(s), ${res.data!.skipped} ignorée(s).`
                    );
                })
              }
              disabled={pending}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
              Synchroniser
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  const res = await startPlatformPaOAuthAction();
                  if (!res.ok) setMessage(res.error);
                  else window.location.href = res.data!.url;
                })
              }
              disabled={pending}
              className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              <Zap className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
              Connecter
            </button>
          )}
        </div>
      </div>
      {message ? <p className="mt-2 text-xs text-gray-500">{message}</p> : null}
    </div>
  );
}
