import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function ServicesLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("services");
  return <>{children}</>;
}
