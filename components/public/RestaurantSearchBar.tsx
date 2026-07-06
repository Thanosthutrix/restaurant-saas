"use client";

import { Search } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  resultCount?: number;
};

export function RestaurantSearchBar({ value, onChange, resultCount }: Props) {
  return (
    <div className="relative w-full">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Trouver un resto..."
        className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-base text-slate-900 shadow-sm shadow-slate-200/50 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
        aria-label="Rechercher un restaurant"
      />
      {resultCount != null ? (
        <p className="mt-2 text-sm text-slate-500">
          {resultCount} restaurant{resultCount > 1 ? "s" : ""} trouvé{resultCount > 1 ? "s" : ""}
        </p>
      ) : null}
    </div>
  );
}
