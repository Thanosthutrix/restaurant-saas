import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function LivraisonLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("livraison");
  return <>{children}</>;
}
