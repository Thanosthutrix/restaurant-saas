"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { completeMetaOAuthAction } from "@/app/restaurants/socialActions";

function parseHashParams(hash: string): Record<string, string> {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  params.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

export function MetaOAuthCompleteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Finalisation de la connexion Meta…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const hash = window.location.hash;
      const hashParams = parseHashParams(hash);
      const state = searchParams.get("state") ?? hashParams.state ?? "";

      const token =
        hashParams.long_lived_token ??
        hashParams.access_token ??
        searchParams.get("long_lived_token") ??
        searchParams.get("access_token");

      if (!token) {
        const err =
          hashParams.error_description ??
          hashParams.error ??
          searchParams.get("error_description") ??
          searchParams.get("error");
        if (!cancelled) {
          setMessage(err ? `Connexion annulée : ${err}` : "Connexion Meta annulée ou jeton manquant.");
        }
        return;
      }

      const result = await completeMetaOAuthAction({ state, accessToken: token });
      if (cancelled) return;

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      router.replace(`/restaurants/${result.data!.restaurantId}/edit?meta=connected`);
      router.refresh();
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-sm text-stone-600">{message}</p>
    </div>
  );
}
