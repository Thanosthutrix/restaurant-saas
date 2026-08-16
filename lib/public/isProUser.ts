import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";

/** True si l'utilisateur connecté a accès à l'espace pro (propriétaire ou staff). */
export async function getIsProUser(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;
    const ctx = await getShellAccessContext(user.id);
    return ctx !== null;
  } catch {
    return false;
  }
}
