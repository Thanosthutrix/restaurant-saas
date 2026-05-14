import { requireNavAccessOrReadonly } from "@/lib/auth/requireNavAccess";

export default async function DishesLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccessOrReadonly("dishes");
  return <>{children}</>;
}
