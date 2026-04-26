import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function ClientsLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("clients");
  return <>{children}</>;
}
