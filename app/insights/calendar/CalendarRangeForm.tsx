import { uiBtnPrimary, uiInput, uiLabel } from "@/components/ui/premium";

export function CalendarRangeForm({ from, to }: { from: string; to: string }) {
  return (
    <form
      className="mt-5 flex flex-col gap-4 rounded-xl border border-slate-100 bg-slate-50/90 p-4 sm:flex-row sm:flex-wrap sm:items-end"
      method="get"
      action="/insights/calendar"
    >
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
        <span className={uiLabel}>Du</span>
        <input type="date" name="from" defaultValue={from} className={uiInput} />
      </label>
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
        <span className={uiLabel}>Au</span>
        <input type="date" name="to" defaultValue={to} className={uiInput} />
      </label>
      <button type="submit" className={uiBtnPrimary}>
        Actualiser la période
      </button>
    </form>
  );
}
