"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchHasProAccess } from "@/lib/public/proAccessClient";

type Props = {
  mode?: "public" | "pro";
};

export function PublicProToggle({ mode = "public" }: Props) {
  const [isProUser, setIsProUser] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchHasProAccess().then((pro) => {
      if (!cancelled) {
        setIsProUser(pro);
        setChecked(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const goPro = useCallback(async () => {
    if (mode === "pro") return;
    let target = "/pro";
    if (!checked) {
      target = (await fetchHasProAccess()) ? "/dashboard" : "/pro";
    } else {
      target = isProUser ? "/dashboard" : "/pro";
    }
    // Navigation complète : évite les 404 Turbopack quand le cache dev est stale.
    window.location.assign(target);
  }, [checked, isProUser, mode]);

  return (
    <div
      className="inline-flex rounded-full border border-slate-200 bg-slate-100/90 p-1 text-xs font-semibold shadow-inner"
      role="group"
      aria-label="Choisir l'espace Public ou Pro"
    >
      <button
        type="button"
        aria-pressed={mode === "public"}
        onClick={() => {
          if (mode !== "public") window.location.assign("/");
        }}
        className={`rounded-full px-3 py-1.5 transition sm:px-4 ${
          mode === "public"
            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        Public
      </button>
      <button
        type="button"
        aria-pressed={mode === "pro"}
        onClick={() => {
          void goPro();
        }}
        className={`rounded-full px-3 py-1.5 transition sm:px-4 ${
          mode === "pro"
            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        Pro
      </button>
    </div>
  );
}
