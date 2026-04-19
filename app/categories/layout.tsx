import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function CategoriesLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("dashboard");
  return <>{children}</>;
}
