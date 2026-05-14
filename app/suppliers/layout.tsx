import { requireNavAccessOrReadonly } from "@/lib/auth/requireNavAccess";

export default async function SuppliersLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccessOrReadonly("suppliers");
  return <>{children}</>;
}
