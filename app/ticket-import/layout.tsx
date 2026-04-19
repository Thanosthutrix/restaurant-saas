import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function TicketImportLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("dashboard");
  return <>{children}</>;
}
