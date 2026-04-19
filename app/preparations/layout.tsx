import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function PreparationsLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("preparations");
  return <>{children}</>;
}
