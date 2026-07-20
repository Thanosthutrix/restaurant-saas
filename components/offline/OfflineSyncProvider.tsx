"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  countQueuedColdReadings,
  OFFLINE_QUEUE_CHANGED_EVENT,
} from "@/lib/offline/coldTemperatureQueue";
import { flushColdTemperatureQueue } from "@/lib/offline/flushColdTemperatureQueue";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";

type OfflineSyncContextValue = {
  online: boolean;
  pendingCount: number;
  syncing: boolean;
  refreshPendingCount: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function useOfflineSync() {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error("useOfflineSync doit être utilisé dans OfflineSyncProvider.");
  }
  return ctx;
}

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await countQueuedColdReadings();
    setPendingCount(count);
  }, []);

  const syncNow = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await flushColdTemperatureQueue();
      await refreshPendingCount();
      if (result.synced > 0) {
        router.refresh();
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refreshPendingCount, router]);

  useEffect(() => {
    void refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    function handleQueueChanged() {
      void refreshPendingCount();
    }
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleQueueChanged);
    return () => window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleQueueChanged);
  }, [refreshPendingCount]);

  useEffect(() => {
    if (online && pendingCount > 0) {
      void syncNow();
    }
  }, [online, pendingCount, syncNow]);

  return (
    <OfflineSyncContext.Provider
      value={{ online, pendingCount, syncing, refreshPendingCount, syncNow }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
}
