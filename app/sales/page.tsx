import Link from "next/link";
import { redirect } from "next/navigation";
import { getTicketImports } from "@/lib/sales";
import { getCurrentRestaurant } from "@/lib/auth";
import { uiError, uiLead, uiListRow, uiPageTitle } from "@/components/ui/premium";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function SalesPage() {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/onboarding");

  const { data: imports, error } = await getTicketImports(restaurant.id);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className={uiError}>Erreur : {error.message}</p>
      </div>
    );
  }

  const list = imports ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className={uiPageTitle}>Ventes</h1>
        <p className={`mt-2 ${uiLead}`}>
          Tickets importés — cliquez pour ouvrir le contrôle et enregistrer les ventes.
        </p>
      </div>
      {list.length === 0 ? (
        <p className={uiLead}>Aucun ticket importé.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((imp) => (
            <li key={imp.id}>
              <Link href={`/ticket-import/${imp.id}`} className={uiListRow}>
                <span className="font-semibold text-slate-900">
                  Ticket du {formatDate(imp.service_date ?? imp.imported_at)}
                </span>
                {imp.service_type && <span className="text-sm text-slate-500">({imp.service_type})</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
