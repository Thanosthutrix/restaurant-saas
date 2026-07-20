"use client";

import { CloudOff, CloudUpload, Loader2, Wifi } from "lucide-react";
import { useOfflineSync } from "@/components/offline/OfflineSyncProvider";

export function OfflineStatusBar() {
  const { online, pendingCount, syncing, syncNow } = useOfflineSync();

  if (online && pendingCount === 0 && !syncing) return null;

  return (
    <div
      className={`sticky top-14 z-[44] border-b px-4 py-2 text-sm ${
        online
          ? "border-sky-200 bg-sky-50 text-sky-900"
          : "border-amber-300 bg-amber-50 text-amber-950"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          {syncing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : online ? (
            <Wifi className="h-4 w-4" aria-hidden />
          ) : (
            <CloudOff className="h-4 w-4" aria-hidden />
          )}
          {!online ? (
            <span>Mode hors ligne — vos saisies seront synchronisées au retour du réseau.</span>
          ) : syncing ? (
            <span>Synchronisation des relevés en cours…</span>
          ) : (
            <span>
              {pendingCount} relevé{pendingCount > 1 ? "s" : ""} en attente de synchronisation.
            </span>
          )}
        </div>
        {online && pendingCount > 0 && !syncing ? (
          <button
            type="button"
            onClick={() => void syncNow()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-white px-2.5 py-1 text-xs font-semibold text-sky-800 transition hover:bg-sky-100"
          >
            <CloudUpload className="h-3.5 w-3.5" aria-hidden />
            Synchroniser
          </button>
        ) : null}
      </div>
    </div>
  );
}
