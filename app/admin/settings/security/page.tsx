import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getMfaStatus } from "@/lib/auth/mfaGate";
import { SecuritySettingsPanel } from "@/components/auth/SecuritySettingsPanel";

export default async function AdminSecuritySettingsPage() {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) redirect("/dashboard");

  const status = await getMfaStatus();

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link
        href="/admin/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-800"
      >
        <ArrowLeft size={15} />
        Paramètres plateforme
      </Link>

      <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
        <Shield size={22} className="text-amber-600" aria-hidden />
        Sécurité administrateur
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        La double authentification est obligatoire pour tous les comptes admin Ubion.
      </p>

      <div className="mt-8">
        <SecuritySettingsPanel
          hasVerifiedTotp={status?.hasVerifiedTotp ?? false}
          verifiedFactors={status?.verifiedFactors ?? []}
          isAdmin
          settingsBackHref="/admin/settings"
          enrollNextUrl="/admin/settings/security"
        />
      </div>
    </div>
  );
}
