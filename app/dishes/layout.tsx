import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function DishesLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("dishes");
  return <>{children}</>;
}
