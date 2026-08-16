"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Zap } from "lucide-react";
import { startPaOAuthAction, syncPaInvoicesAction } from "./paActions";
import { uiBtnPrimarySm, uiBtnSecondary, uiCard, uiMuted } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
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

export function PaConnectionCard({ restaurantId, connection }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const handleConnect = () => {
    startTransition(async () => {
      const res = await startPaOAuthAction(restaurantId);
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      window.location.href = res.data!.url;
    });
  };

  const handleSync = () => {
    startTransition(async () => {
      const res = await syncPaInvoicesAction(restaurantId);
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setMessage(
        `${res.data!.fetched} facture(s) lue(s), ${res.data!.created} importée(s), ${res.data!.skipped} déjà connue(s).`
      );
    });
  };

  const status = connection?.enrollmentStatus ?? "not_enrolled";

  return (
    <div className={uiCard}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-900">Réception automatique (Super PDP, bac à sable)</p>
          <p className={uiMuted}>
            {STATUS_LABEL[status] ?? status}
            {connection?.companyVerificationStatus === "needs_review" ? " · vérification en cours côté Super PDP" : ""}
            {connection?.lastInvoiceReceivedAt
              ? ` · dernière synchro : ${new Date(connection.lastInvoiceReceivedAt).toLocaleString("fr-FR")}`
              : ""}
          </p>
          {connection?.lastError ? <p className="mt-1 text-xs text-rose-700">{connection.lastError}</p> : null}
        </div>
        <div className="flex gap-2">
          {status === "active" ? (
            <button type="button" className={uiBtnSecondary} onClick={handleSync} disabled={pending}>
              <RefreshCw className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
              Synchroniser maintenant
            </button>
          ) : (
            <button type="button" className={uiBtnPrimarySm} onClick={handleConnect} disabled={pending}>
              <Zap className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
              Connecter Super PDP
            </button>
          )}
        </div>
      </div>
      {message ? <p className={`mt-2 ${uiMuted}`}>{message}</p> : null}
    </div>
  );
}
