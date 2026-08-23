"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/admin";
import { isPaOAuthConfigured } from "@/lib/pa/config";
import { buildPaAuthorizeUrl } from "@/lib/pa/oauthClient";
import { encodePaOAuthState } from "@/lib/pa/oauthState";
import { getCurrentUser } from "@/lib/auth";
import { getPlatformCompany } from "@/lib/platform/companyDb";
import {
  syncPlatformPaInvoices,
  type PlatformSyncResult,
} from "@/lib/platform/syncPlatformPaInvoices";
import {
  syncPlatformPaEmittedInvoices,
  type PlatformEmittedSyncResult,
} from "@/lib/platform/syncPlatformPaEmittedInvoices";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export async function startPlatformPaOAuthAction(): Promise<ActionResult<{ url: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Connectez-vous pour continuer." };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Accès refusé." };
  if (!isPaOAuthConfigured()) {
    return { ok: false, error: "OAuth Super PDP non configuré." };
  }

  const company = await getPlatformCompany();
  if (!company) {
    return { ok: false, error: "Configurez d'abord le profil de votre société." };
  }

  const state = encodePaOAuthState({
    scope: "platform",
    companyId: company.id,
    userId: user.id,
    ts: Date.now(),
  });
  const url = buildPaAuthorizeUrl({
    state,
    companyNumberScheme: "sandbox",
    sendAndReceive: "both",
  });
  return { ok: true, data: { url } };
}

export async function syncPlatformPaInvoicesAction(): Promise<ActionResult<PlatformSyncResult>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Connectez-vous pour continuer." };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Accès refusé." };

  const company = await getPlatformCompany();
  if (!company) return { ok: false, error: "Société non configurée." };

  const result = await syncPlatformPaInvoices(company.id);
  revalidatePath("/admin/company/invoices");
  if (result.error) return { ok: false, error: result.error };
  return { ok: true, data: result };
}

export async function syncPlatformPaEmittedInvoicesAction(): Promise<
  ActionResult<PlatformEmittedSyncResult>
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Connectez-vous pour continuer." };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Accès refusé." };

  const company = await getPlatformCompany();
  if (!company) return { ok: false, error: "Société non configurée." };

  const result = await syncPlatformPaEmittedInvoices(company.id);
  revalidatePath("/admin/company/emitted");
  if (result.error) return { ok: false, error: result.error };
  return { ok: true, data: result };
}
