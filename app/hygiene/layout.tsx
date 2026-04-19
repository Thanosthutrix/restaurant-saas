import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function HygieneLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("hygiene");
  return <>{children}</>;
}
