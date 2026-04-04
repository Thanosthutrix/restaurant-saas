import Link from "next/link";
import { uiLead, uiSegmentActive, uiSegmentIdle } from "@/components/ui/premium";

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function MarginsDateRangeLinks({ currentFrom, currentTo }: { currentFrom: string; currentTo: string }) {
  const to = new Date();
  const d7 = new Date(to);
  d7.setUTCDate(d7.getUTCDate() - 7);
  const d30 = new Date(to);
  d30.setUTCDate(d30.getUTCDate() - 30);
  const d90 = new Date(to);
  d90.setUTCDate(d90.getUTCDate() - 90);

  const end = isoDay(to);
  const presets = [
    { label: "7 jours", from: isoDay(d7), to: end },
    { label: "30 jours", from: isoDay(d30), to: end },
    { label: "90 jours", from: isoDay(d90), to: end },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className={uiLead}>Période :</span>
      {presets.map((p) => {
        const active = p.from === currentFrom && p.to === currentTo;
        return (
          <Link
            key={p.label}
            href={`/margins?from=${p.from}&to=${p.to}`}
            className={active ? uiSegmentActive : uiSegmentIdle}
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}
