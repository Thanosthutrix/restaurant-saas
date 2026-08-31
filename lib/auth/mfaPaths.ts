/** Chemins exclus du contrôle MFA (enrollment, vérification, auth de base). */
export function isMfaExemptPath(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password") return true;
  if (pathname === "/compte/connexion" || pathname === "/compte/inscription") return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/join")) return true;
  return false;
}

export function mfaVerifyUrl(next: string, required = false): string {
  const params = new URLSearchParams({ next });
  if (required) params.set("required", "1");
  return `/auth/mfa-verify?${params.toString()}`;
}

export function mfaEnrollUrl(next: string, required = false): string {
  const params = new URLSearchParams({ next });
  if (required) params.set("required", "1");
  return `/auth/mfa-enroll?${params.toString()}`;
}
