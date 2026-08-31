"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatAuthClientError } from "@/lib/supabase/authErrors";
import { buildOAuthCallbackUrl, type OAuthFlow, type OAuthProvider } from "@/lib/auth/oauthProfile";
import { uiBtnSecondary, uiError } from "@/components/ui/premium";

type Props = {
  flow: OAuthFlow;
  nextUrl: string;
  /** Style pro (stone/copper) ou consommateur (slate/orange). */
  variant?: "pro" | "consumer";
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-5 w-5"} fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

export function SocialAuthButtons({ flow, nextUrl, variant = "pro" }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<OAuthProvider | null>(null);

  async function handleOAuth(provider: OAuthProvider) {
    setError(null);
    setLoading(provider);

    const supabase = createClient();
    const origin = window.location.origin;
    const redirectTo = buildOAuthCallbackUrl(origin, flow, nextUrl);

    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        ...(provider === "google"
          ? { queryParams: { access_type: "offline", prompt: "consent" } }
          : { scopes: "email name" }),
      },
    });

    if (oauthErr) {
      setLoading(null);
      setError(formatAuthClientError(oauthErr.message));
    }
  }

  const btnClass =
    variant === "consumer"
      ? "flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
      : `${uiBtnSecondary} flex w-full items-center justify-center gap-3 py-2.5`;

  const appleBtnClass =
    variant === "consumer"
      ? "flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-900 bg-slate-900 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
      : "flex w-full items-center justify-center gap-3 rounded-xl border border-stone-900 bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50";

  const dividerBg = variant === "consumer" ? "bg-white" : "bg-white";

  return (
    <div className="space-y-3">
      {error ? <p className={variant === "consumer" ? "rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" : uiError}>{error}</p> : null}

      <button type="button" disabled={loading !== null} onClick={() => void handleOAuth("google")} className={btnClass}>
        <GoogleIcon />
        {loading === "google" ? "Redirection…" : "Continuer avec Google"}
      </button>

      <button type="button" disabled={loading !== null} onClick={() => void handleOAuth("apple")} className={appleBtnClass}>
        <AppleIcon className="h-5 w-5" />
        {loading === "apple" ? "Redirection…" : "Continuer avec Apple"}
      </button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-stone-200" />
        </div>
        <div className="relative flex justify-center">
          <span className={`${dividerBg} px-2 text-xs font-medium text-stone-400`}>ou</span>
        </div>
      </div>
    </div>
  );
}
