/**
 * Layout de l'espace admin Ubion.
 * Double protection : le middleware bloque déjà les non-admins,
 * mais on revérifie ici pour être sûr.
 */

import { redirect } from "next/navigation";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { countPendingTrialRequests } from "@/lib/pro/trialRequestDb";
import { AdminPendingTrialAlert } from "@/components/admin/AdminPendingTrialAlert";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAdmin, user, pendingTrialCount] = await Promise.all([
    isCurrentUserAdmin(),
    getCurrentUser(),
    countPendingTrialRequests(),
  ]);

  if (!isAdmin) redirect("/dashboard");

  return (
    <AdminShell userEmail={user?.email} pendingTrialCount={pendingTrialCount}>
      <AdminPendingTrialAlert count={pendingTrialCount} variant="banner" />
      {children}
    </AdminShell>
  );
}
