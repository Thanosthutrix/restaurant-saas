import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function CuisineLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("cuisine");
  return <>{children}</>;
}
