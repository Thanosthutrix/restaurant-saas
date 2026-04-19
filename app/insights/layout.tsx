import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function InsightsLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("insights");
  return <>{children}</>;
}
