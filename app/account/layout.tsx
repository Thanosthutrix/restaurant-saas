import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("account");
  return <>{children}</>;
}
