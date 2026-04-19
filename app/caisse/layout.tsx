import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function CaisseLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("caisse");
  return <>{children}</>;
}
