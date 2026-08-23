"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { NativeBillingNotice } from "@/components/billing/NativeBillingNotice";
import { isNativeApp } from "@/lib/capacitor/platform";
import { uiBtnPrimary, uiBtnSecondary } from "@/components/ui/premium";

type Props = {
  mode: "checkout" | "portal";
  label?: string;
  className?: string;
  /** Masque Stripe in-app (App Store). */
  hideInNative?: boolean;
};

export function BillingActionButton({ mode, label, className, hideInNative = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hideInNative || isNativeApp()) {
    return (
      <NativeBillingNotice
        context={mode === "checkout" ? "blocked" : "manage"}
        forceShow={hideInNative}
        className={className}
      />
    );
  }

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const endpoint = mode === "checkout" ? "/api/billing/checkout" : "/api/billing/portal";
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erreur.");
      if (!data.url) throw new Error("URL de redirection manquante.");
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
      setLoading(false);
    }
  }

  const defaultLabel =
    mode === "checkout" ? "S'abonner à Ubion Pro" : "Gérer mon abonnement";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`${mode === "checkout" ? uiBtnPrimary : uiBtnSecondary} inline-flex w-full items-center justify-center gap-2`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {loading ? "Redirection…" : (label ?? defaultLabel)}
      </button>
      {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
