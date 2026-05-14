import { requireNavAccessOrReadonly } from "@/lib/auth/requireNavAccess";

export default async function SupplierInvoicesLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccessOrReadonly("supplier_invoices");
  return <>{children}</>;
}
