import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import {
  type ShellNavKey,
  type PageAccessLevel,
  getPageAccessLevel,
} from "@/lib/auth/appRoles";

/** Accès refusé si la clé n'est pas dans le périmètre du rôle. */
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

/**
 * Accès à une page en mode lecture seule ou complet.
 * Redirige vers /dashboard si aucun des deux niveaux n'est accordé.
 * Retourne "full" ou "readonly" selon le niveau effectif.
 */
export async function requireNavAccessOrReadonly(
  navKey: ShellNavKey
): Promise<PageAccessLevel> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ctx = await getShellAccessContext(user.id);
  if (!ctx) redirect("/onboarding");
  if (ctx.isOwner) return "full";
  const level = getPageAccessLevel(navKey, ctx.allowedNavKeys);
  if (level === "none") redirect("/dashboard");
  return level;
}

/**
 * Retourne le niveau d'accès sans rediriger (pour les composants serveur qui
 * ont déjà été protégés par requireNavAccess mais ont besoin du niveau).
 */
export async function getNavAccessLevel(
  navKey: ShellNavKey
): Promise<PageAccessLevel> {
  const user = await getCurrentUser();
  if (!user) return "none";
  const ctx = await getShellAccessContext(user.id);
  if (!ctx) return "none";
  if (ctx.isOwner) return "full";
  return getPageAccessLevel(navKey, ctx.allowedNavKeys);
}
