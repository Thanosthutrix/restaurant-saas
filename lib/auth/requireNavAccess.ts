import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import type { ShellNavKey } from "@/lib/auth/appRoles";

/** Accès refusé si la clé n’est pas dans le périmètre du rôle. */
export async function requireNavAccess(navKey: ShellNavKey): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ctx = await getShellAccessContext(user.id);
  if (!ctx) redirect("/onboarding");
  if (!ctx.allowedNavKeys.includes(navKey)) {
    redirect("/dashboard");
  }
}

export async function requireAnyNavAccess(keys: ShellNavKey[]): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ctx = await getShellAccessContext(user.id);
  if (!ctx) redirect("/onboarding");
  if (!keys.some((k) => ctx.allowedNavKeys.includes(k))) {
    redirect("/dashboard");
  }
}
