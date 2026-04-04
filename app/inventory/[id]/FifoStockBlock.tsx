import type { FifoItemSummary } from "@/lib/stock/fifo";
import { uiCard, uiMuted, uiWarn } from "@/components/ui/premium";

function formatEur(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatOpenedAt(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function FifoStockBlock({
  stockUnit,
  summary,
  fifoError,
}: {
  stockUnit: string;
  summary: FifoItemSummary;
  fifoError: string | null;
}) {
  return (
    <div className={uiCard}>
      <h2 className="mb-1 text-sm font-semibold text-slate-900">FIFO & valorisation</h2>
      <p className={`mb-3 ${uiMuted}`}>
        Lots ouverts (entrées non entièrement consommées). Coûts en € HT par unité de stock (
        {stockUnit}) lorsqu’ils sont connus (facture liée à la réception ou ajustement au CMP).
      </p>
      {fifoError && <p className={`mb-2 ${uiWarn}`}>{fifoError}</p>}
      {summary.openLots.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucun lot ouvert : stock entièrement sorti, pas encore d’entrée avec couche FIFO, ou données
          antérieures à la mise en place des lots.
        </p>
      ) : (
        <>
          <dl className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-slate-500">Qté dans les lots</dt>
              <dd className="font-semibold text-slate-900">
                {summary.qtyInOpenLots} {stockUnit}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Valeur (coûts connus)</dt>
              <dd className="font-semibold text-slate-900">
                {summary.valueKnownCostEur != null
                  ? formatEur(summary.valueKnownCostEur)
                  : "— (aucun coût unitaire sur ces lots)"}
              </dd>
            </div>
          </dl>
          <ul className="space-y-2 border-t border-slate-100 pt-3">
            {summary.openLots.map((lot) => (
              <li
                key={lot.lotId}
                className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-slate-700"
              >
                <span>
                  <span className="font-semibold">{lot.qtyRemaining}</span> / {lot.qtyInitial}{" "}
                  {stockUnit}
                  {lot.movementReference ? (
                    <span className="text-slate-500">
                      {" "}
                      · {lot.movementReference}
                    </span>
                  ) : null}
                </span>
                <span className="text-slate-500">
                  {lot.unitCost != null ? `${formatEur(lot.unitCost)} / ${stockUnit}` : "Coût inconnu"}
                  {" · "}
                  {formatOpenedAt(lot.openedAt)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
