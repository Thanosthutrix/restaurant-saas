"use client";

import { useRouter } from "next/navigation";

type Props = {
  mode?: "public" | "pro";
};

export function PublicProToggle({ mode = "public" }: Props) {
  const router = useRouter();

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
          if (mode !== "public") router.push("/");
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
          if (mode !== "pro") router.push("/dashboard");
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
