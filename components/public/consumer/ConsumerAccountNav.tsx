"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserRound } from "lucide-react";
import type { ConsumerProfile } from "@/lib/public/consumer/types";

export function ConsumerAccountNav() {
  const [profile, setProfile] = useState<ConsumerProfile | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/compte/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setProfile(data?.profile ?? null);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (profile === undefined) {
    return (
      <span className="hidden h-9 w-24 animate-pulse rounded-lg bg-slate-100 sm:inline-block" />
    );
  }

  if (profile) {
    return (
      <Link
        href="/compte"
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 sm:px-3 sm:py-2"
      >
        <UserRound className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Mon compte</span>
      </Link>
    );
  }

  return (
    <Link
      href="/compte/connexion"
      className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:px-3 sm:py-2"
    >
      <span className="hidden sm:inline">Connexion</span>
      <UserRound className="h-4 w-4 sm:hidden" aria-hidden />
    </Link>
  );
}
