import "server-only";

import { getAccessibleRestaurantsForUser, getCurrentUser } from "@/lib/auth";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getActiveSignupEntitlement } from "@/lib/pro/signupEntitlementDb";

function safeInternalPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

/** Destination après connexion — les admins plateforme vont toujours vers /admin. */
export async function resolvePostLoginPath(next?: string | null): Promise<string> {
  if (await isCurrentUserAdmin()) return "/admin";

  const safeNext = safeInternalPath(next);
  if (safeNext && !safeNext.startsWith("/admin")) return safeNext;

  const user = await getCurrentUser();
  if (!user) return "/login";

  const owned = await getAccessibleRestaurantsForUser(user.id);
  if (owned.length > 0) return "/dashboard";

  const entitlement = await getActiveSignupEntitlement(user.id);
  if (entitlement) return "/onboarding";

  return "/onboarding/start";
}

/** Chemins pro où un admin plateforme doit être renvoyé vers /admin. */
export function isProSpacePathForAdminRedirect(pathname: string): boolean {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return true;
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return true;
  if (pathname === "/access-blocked") return true;
  if (pathname === "/settings/billing" || pathname.startsWith("/settings/billing/")) return true;
  return false;
}
