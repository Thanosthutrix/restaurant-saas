import { requireAnyNavAccess } from "@/lib/auth/requireNavAccess";

export default async function ServiceLayout({ children }: { children: React.ReactNode }) {
  await requireAnyNavAccess(["service_new", "services"]);
  return <>{children}</>;
}
