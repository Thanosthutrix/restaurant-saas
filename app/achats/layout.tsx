import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function AchatsLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("achats");
  return <>{children}</>;
}
