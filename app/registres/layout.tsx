import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function RegistresLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("registres");
  return <>{children}</>;
}
