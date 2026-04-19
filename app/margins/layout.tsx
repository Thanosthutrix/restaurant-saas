import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function MarginsLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("margins");
  return <>{children}</>;
}
