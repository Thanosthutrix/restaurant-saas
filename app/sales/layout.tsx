import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("dashboard");
  return <>{children}</>;
}
