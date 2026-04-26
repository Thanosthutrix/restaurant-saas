import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function ReservationsLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("reservations");
  return <>{children}</>;
}
