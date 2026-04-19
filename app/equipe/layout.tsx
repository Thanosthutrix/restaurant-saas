import { requireAnyNavAccess } from "@/lib/auth/requireNavAccess";

export default async function EquipeLayout({ children }: { children: React.ReactNode }) {
  await requireAnyNavAccess(["equipe_manage", "equipe_self"]);
  return <>{children}</>;
}
