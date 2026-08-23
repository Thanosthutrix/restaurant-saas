"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

type TrialStatusResponse = {
  status: "pending" | "approved" | "rejected" | "none";
  trialDays?: number;
  daysRemaining?: number;
};

/** Détecte l'approbation d'essai en direct (page onboarding/start). */
export function TrialApprovedWatcher({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [justApproved, setJustApproved] = useState(false);
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!enabled || notifiedRef.current) return;

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/pro/trial-status", { credentials: "same-origin" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as TrialStatusResponse;
        if (data.status !== "approved" || cancelled) return;

        notifiedRef.current = true;
        setJustApproved(true);

        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Essai Ubion Pro activé", {
            body: "Votre essai est prêt — vous pouvez créer votre établissement.",
            tag: "ubion-trial-approved",
          });
        }

        router.refresh();
      } catch {
        /* ignore */
      }
    }

    void check();
    const id = window.setInterval(check, 12_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, router]);

  if (!justApproved) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-900 shadow-sm">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden />
      <div>
        <p className="font-semibold">Votre essai a été validé !</p>
        <p className="mt-1 text-green-800">
          Vous pouvez maintenant créer votre établissement.{" "}
          <a href="/onboarding" className="font-medium underline underline-offset-2">
            Continuer →
          </a>
        </p>
      </div>
    </div>
  );
}
