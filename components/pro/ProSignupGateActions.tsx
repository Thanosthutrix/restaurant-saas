"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, Send } from "lucide-react";
import { NativeBillingNotice } from "@/components/billing/NativeBillingNotice";
import { isNativeApp } from "@/lib/capacitor/platform";
import { uiBtnPrimary, uiBtnSecondary } from "@/components/ui/premium";
import { formatBillingOfferDetail, formatBillingOfferShort } from "@/lib/billing/config";

type Props = {
  mode: "checkout" | "trial-request";
  defaultRestaurantName?: string;
  stripeReady: boolean;
  /** Masque le paiement (App Store — abonnement via le web uniquement). */
  hideCheckout?: boolean;
};

export function ProSignupGateActions({
  mode,
  defaultRestaurantName,
  stripeReady,
  hideCheckout = false,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState(defaultRestaurantName ?? "");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/pre-checkout", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erreur.");
      if (!data.url) throw new Error("URL de redirection manquante.");
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
      setLoading(false);
    }
  }

  async function handleTrialRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pro/trial-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantName: restaurantName.trim() || null,
          message: message.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erreur.");
      setSubmitted(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "checkout") {
    if (hideCheckout || isNativeApp()) {
      return <NativeBillingNotice context="signup" forceShow={hideCheckout} />;
    }
    if (!stripeReady) {
      return (
        <p className="text-sm text-amber-700">
          Le paiement en ligne n&apos;est pas encore disponible. Demandez un essai ou contactez Ubion.
        </p>
      );
    }
    return (
      <div>
        <button
          type="button"
          onClick={handleCheckout}
          disabled={loading}
          className={`${uiBtnPrimary} inline-flex w-full items-center justify-center gap-2`}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {loading ? "Redirection…" : `S'abonner — ${formatBillingOfferShort()}`}
        </button>
        <p className="mt-2 text-xs text-stone-500">{formatBillingOfferDetail()}</p>
        {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  if (submitted) {
    return (
      <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Demande envoyée. Vous recevrez un e-mail dès que votre essai sera activé par l&apos;équipe Ubion.
      </p>
    );
  }

  return (
    <form onSubmit={handleTrialRequest} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Nom de l&apos;établissement</label>
        <input
          type="text"
          value={restaurantName}
          onChange={(e) => setRestaurantName(e.target.value)}
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          placeholder="Ex. Le Comptoir"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Message (optionnel)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          placeholder="Présentez brièvement votre projet…"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className={`${uiBtnSecondary} inline-flex w-full items-center justify-center gap-2`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {loading ? "Envoi…" : "Demander un essai"}
      </button>
      {error && <p className="text-center text-xs text-red-600">{error}</p>}
    </form>
  );
}
