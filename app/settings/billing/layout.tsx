import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function BillingSettingsLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("settings");
  const user = await getCurrentUser();
  const ctx = user ? await getShellAccessContext(user.id) : null;
  if (!ctx?.isOwner) redirect("/settings");
  return children;
}
