import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPlatformCompany, listPlatformSuppliers } from "@/lib/platform/companyDb";
import {
  getPlatformInvoice,
  platformInvoicePublicUrl,
} from "@/lib/platform/companyInvoicesDb";
import { listPlatformInvoiceExtractedLines } from "@/lib/platform/runPlatformInvoiceAnalysis";
import { PlatformInvoiceDetailForm } from "./PlatformInvoiceDetailForm";

type Props = { params: Promise<{ id: string }> };

export default async function AdminCompanyInvoiceDetailPage({ params }: Props) {
  const company = await getPlatformCompany();
  if (!company) redirect("/admin/company");

  const { id } = await params;
  const [invoice, suppliers, lines] = await Promise.all([
    getPlatformInvoice(company.id, id),
    listPlatformSuppliers(company.id),
    listPlatformInvoiceExtractedLines(id),
  ]);

  if (!invoice) notFound();

  const fileUrl = platformInvoicePublicUrl(invoice.file_path);

  return (
    <div className="mx-auto max-w-3xl pb-4">
      <Link href="/admin/company/invoices" className="text-xs text-gray-500 hover:text-gray-700">
        ← Factures
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">Contrôle facture</h1>
      <p className="mt-1 text-sm text-gray-500">
        Vérifiez les montants et le classement comptable avant export comptable.
      </p>

      <div className="mt-6">
        <PlatformInvoiceDetailForm
          invoice={invoice}
          suppliers={suppliers}
          fileUrl={fileUrl}
          extractedLines={lines}
        />
      </div>
    </div>
  );
}
