import type { ReactNode } from "react";

type MockProps = { className?: string };

function MockShell({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-xl shadow-stone-900/10 ${className}`}
    >
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
        <span className="text-sm font-bold text-stone-900">{title}</span>
        {subtitle ? <div className="text-xs text-stone-500">{subtitle}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function ProDashboardMock({ className }: MockProps) {
  return (
    <MockShell title="Dashboard" subtitle="Aujourd'hui · en direct" className={className}>
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: "CA du jour", value: "2 840 €", color: "text-copper-700" },
          { label: "Couverts", value: "47", color: "text-stone-900" },
          { label: "Marge brute", value: "72 %", color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Ticket moyen", value: "60 €", color: "text-stone-900" },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-xl px-3 py-2.5 ${kpi.bg ?? "bg-stone-50"}`}>
            <div className="text-[10px] font-medium text-stone-500">{kpi.label}</div>
            <div className={`text-xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>
      <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wider text-stone-400">Best-sellers</p>
      {[
        { name: "Bœuf bourguignon", count: "18×", hot: true },
        { name: "Magret de canard", count: "12×", hot: false },
        { name: "Tarte tatin", count: "9×", hot: false },
      ].map((row) => (
        <div key={row.name} className="flex items-center justify-between border-b border-stone-50 py-2 last:border-0">
          <span className="text-sm font-semibold text-stone-900">{row.name}</span>
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-bold ${
              row.hot ? "bg-copper-50 text-copper-800" : "bg-stone-50 text-stone-500"
            }`}
          >
            {row.count}
          </span>
        </div>
      ))}
    </MockShell>
  );
}

export function ProStockMock({ className }: MockProps) {
  const items = [
    { name: "Bœuf paleron", qty: "1,2 kg", pct: 12, color: "bg-rose-500" },
    { name: "Crème fraîche", qty: "2,0 L", pct: 20, color: "bg-copper-500" },
    { name: "Vin rouge", qty: "3 btl", pct: 25, color: "bg-copper-500" },
    { name: "Pommes de terre", qty: "8,5 kg", pct: 42, color: "bg-emerald-500" },
  ];

  return (
    <MockShell
      title="Stocks — Alertes"
      subtitle={<span className="font-semibold text-rose-600">3 produits critiques</span>}
      className={className}
    >
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.name}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-semibold text-stone-900">{item.name}</span>
              <span className="font-bold text-stone-600">{item.qty}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </MockShell>
  );
}

export function ProFloorPlanMock({ className }: MockProps) {
  const tables = [
    { n: "T1", p: 2, st: "free" },
    { n: "T2", p: 4, st: "occupied" },
    { n: "T3", p: 2, st: "free" },
    { n: "T4", p: 4, st: "bill" },
    { n: "T5", p: 6, st: "occupied" },
    { n: "T6", p: 2, st: "free" },
    { n: "T7", p: 4, st: "occupied" },
    { n: "T8", p: 2, st: "free" },
    { n: "T9", p: 4, st: "occupied" },
  ] as const;

  const styles = {
    free: "border-emerald-200 bg-emerald-50 text-emerald-800",
    occupied: "border-amber-200 bg-amber-50 text-amber-900",
    bill: "border-rose-200 bg-rose-50 text-rose-900",
  };

  return (
    <MockShell title="Plan de salle" subtitle="Service du midi" className={className}>
      <div className="grid grid-cols-3 gap-2">
        {tables.map((t) => (
          <div
            key={t.n}
            className={`rounded-xl border px-2 py-3 text-center ${styles[t.st]}`}
          >
            <div className="text-sm font-bold">{t.n}</div>
            <div className="text-[10px] opacity-70">{t.p} cvts</div>
          </div>
        ))}
      </div>
    </MockShell>
  );
}

export function ProRecipeMock({ className }: MockProps) {
  return (
    <MockShell title="Bœuf bourguignon" subtitle="Fiche technique" className={className}>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-stone-100 text-[10px] uppercase tracking-wide text-stone-400">
            <th className="pb-2 text-left font-bold">Ingrédient</th>
            <th className="pb-2 text-left font-bold">Qté</th>
            <th className="pb-2 text-right font-bold">Coût</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Bœuf paleron", "250 g", "3,12 €"],
            ["Carottes", "80 g", "0,24 €"],
            ["Vin rouge", "15 cl", "0,48 €"],
            ["Champignons", "60 g", "0,36 €"],
          ].map(([a, b, c]) => (
            <tr key={a} className="border-b border-stone-50">
              <td className="py-2 font-semibold text-stone-900">{a}</td>
              <td className="py-2 text-stone-500">{b}</td>
              <td className="py-2 text-right font-semibold text-stone-900">{c}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex justify-between rounded-xl bg-stone-50 px-3 py-2 text-sm">
        <span className="font-semibold text-stone-600">Total matière HT</span>
        <span className="font-bold text-stone-900">4,20 €</span>
      </div>
      <div className="mt-2 flex justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm">
        <span className="font-semibold text-emerald-800">Prix de vente · 13,20 €</span>
        <span className="font-bold text-emerald-700">Marge 68 %</span>
      </div>
    </MockShell>
  );
}

export function ProReservationsMock({ className }: MockProps) {
  return (
    <MockShell title="Réservations" subtitle="Ce soir · 18 couverts" className={className}>
      {[
        { time: "19:00", name: "Dupont · 4 cvts", status: "Confirmée" },
        { time: "19:30", name: "Martin · 2 cvts", status: "En attente" },
        { time: "20:00", name: "Bernard · 6 cvts", status: "Confirmée" },
        { time: "20:30", name: "Leroy · 2 cvts", status: "Site web" },
      ].map((r) => (
        <div key={r.time} className="flex items-center gap-3 border-b border-stone-50 py-2.5 last:border-0">
          <span className="w-12 shrink-0 text-sm font-bold tabular-nums text-copper-700">{r.time}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-stone-900">{r.name}</div>
          </div>
          <span className="shrink-0 rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
            {r.status}
          </span>
        </div>
      ))}
    </MockShell>
  );
}

export function ProHaccpMock({ className }: MockProps) {
  const checks = [
    { label: "Frigo cuisine", ok: true, temp: "3,2 °C" },
    { label: "Cellule froide", ok: true, temp: "1,8 °C" },
    { label: "Réception", ok: false, temp: "—" },
    { label: "Nettoyage sol", ok: true, temp: "Validé" },
  ];

  return (
    <MockShell title="Registre HACCP" subtitle="Contrôles du jour" className={className}>
      <div className="space-y-2">
        {checks.map((c) => (
          <div
            key={c.label}
            className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
              c.ok ? "border-emerald-100 bg-emerald-50/60" : "border-amber-100 bg-amber-50/60"
            }`}
          >
            <span className="text-sm font-semibold text-stone-900">{c.label}</span>
            <span className={`text-xs font-bold ${c.ok ? "text-emerald-700" : "text-amber-700"}`}>
              {c.temp}
            </span>
          </div>
        ))}
      </div>
    </MockShell>
  );
}

export function ProAppMockup({ type, className }: { type: ProSolutionMock; className?: string }) {
  switch (type) {
    case "dashboard":
      return <ProDashboardMock className={className} />;
    case "stock":
      return <ProStockMock className={className} />;
    case "floor":
      return <ProFloorPlanMock className={className} />;
    case "recipe":
      return <ProRecipeMock className={className} />;
    case "reservations":
      return <ProReservationsMock className={className} />;
    case "haccp":
      return <ProHaccpMock className={className} />;
    default:
      return <ProDashboardMock className={className} />;
  }
}

export type ProSolutionMock =
  | "dashboard"
  | "stock"
  | "floor"
  | "recipe"
  | "reservations"
  | "haccp";
