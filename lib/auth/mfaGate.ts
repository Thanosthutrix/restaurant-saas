import "server-only";

import { isCurrentUserAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { mfaEnrollUrl, mfaVerifyUrl } from "@/lib/auth/mfaPaths";

export type VerifiedTotpFactor = {
  id: string;
  friendlyName: string | null;
  createdAt: string;
};

export type MfaStatus = {
  hasVerifiedTotp: boolean;
  verifiedFactors: VerifiedTotpFactor[];
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
  needsVerify: boolean;
  adminMustEnroll: boolean;
};

function safeInternalPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return "/dashboard";
  return path;
}

export async function getMfaStatus(): Promise<MfaStatus | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: aal }, { data: factors }, isAdmin] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
    isCurrentUserAdmin(),
  ]);

  const verifiedFactors: VerifiedTotpFactor[] = (factors?.totp ?? [])
    .filter((f) => f.status === "verified")
    .map((f) => ({
      id: f.id,
      friendlyName: f.friendly_name ?? null,
      createdAt: f.created_at,
    }));

  const currentLevel = (aal?.currentLevel as MfaStatus["currentLevel"]) ?? null;
  const nextLevel = (aal?.nextLevel as MfaStatus["nextLevel"]) ?? null;
  const hasVerifiedTotp = verifiedFactors.length > 0;
  const needsVerify = hasVerifiedTotp && currentLevel === "aal1" && nextLevel === "aal2";
  const adminMustEnroll = isAdmin && !hasVerifiedTotp;

  return {
    hasVerifiedTotp,
    verifiedFactors,
    currentLevel,
    nextLevel,
    needsVerify,
    adminMustEnroll,
  };
}

/** Redirection MFA avant d'atteindre une route protégée, ou null si OK. */
export async function resolveMfaRedirect(nextPath: string): Promise<string | null> {
  const status = await getMfaStatus();
  if (!status) return null;

  const next = safeInternalPath(nextPath);

  if (status.adminMustEnroll) {
    return mfaEnrollUrl(next, true);
  }

  if (status.needsVerify) {
    return mfaVerifyUrl(next, false);
  }

  return null;
}
