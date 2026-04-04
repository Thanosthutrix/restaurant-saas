import { uiBtnSecondary, uiInput, uiLabel } from "@/components/ui/premium";

export function MarginsCustomRangeForm({ from, to }: { from: string; to: string }) {
  return (
    <form className="mt-3 flex flex-wrap items-end gap-3 text-sm" method="get" action="/margins">
      <label className="flex flex-col gap-0.5">
        <span className={uiLabel}>Du</span>
        <input type="date" name="from" defaultValue={from} className={uiInput} />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className={uiLabel}>Au</span>
        <input type="date" name="to" defaultValue={to} className={uiInput} />
      </label>
      <button type="submit" className={uiBtnSecondary}>
        Appliquer
      </button>
    </form>
  );
}
