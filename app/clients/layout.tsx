import { requireNavAccessOrReadonly } from "@/lib/auth/requireNavAccess";

export default async function ClientsLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccessOrReadonly("clients");
  return <>{children}</>;
}
