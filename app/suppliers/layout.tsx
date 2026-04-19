import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function SuppliersLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("suppliers");
  return <>{children}</>;
}
