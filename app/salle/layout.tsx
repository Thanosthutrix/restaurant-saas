import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function SalleLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("salle");
  return <>{children}</>;
}
