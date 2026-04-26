"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { filterCustomersLocalPool, type CustomerLookupRow } from "@/lib/customers/customersDb";
import { searchCustomersLookupAction } from "@/app/clients/actions";
import { setDiningOrderCustomerAction } from "@/app/salle/actions";
import { CustomerTicketMemoDialog } from "./CustomerTicketMemoDialog";
import { uiBtnOutlineSm, uiInput } from "@/components/ui/premium";

type LinkedCustomer = {
  id: string;
  display_name: string;
  service_memo: string | null;
  allergens_note: string | null;
};

type Props = {
  restaurantId: string;
  orderId: string;
  linked: LinkedCustomer | null;
  recentCustomerPool: CustomerLookupRow[];
};

export function DiningOrderCustomerLinkPanel({ restaurantId, orderId, linked, recentCustomerPool }: Props) {
  const router = useRouter();
  const [memoOpen, setMemoOpen] = useState(false);
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [serverHits, setServerHits] = useState<CustomerLookupRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const localMatches = useMemo(() => filterCustomersLocalPool(recentCustomerPool, q, 8), [recentCustomerPool, q]);

  const runServerSearch = useCallback(
    (query: string) => {
      if (query.trim().length < 2) {
        setServerHits([]);
        setSearchLoading(false);
        return;
      }
      if (localMatches.length > 0) {
        setServerHits([]);
        setSearchLoading(false);
        return;
      }
      setSearchLoading(true);
      void (async () => {
        const r = await searchCustomersLookupAction(restaurantId, query);
        setSearchLoading(false);
        setServerHits(r.ok ? r.rows : []);
      })();
    },
    [restaurantId, localMatches.length]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setServerHits([]);
      return;
    }
    if (localMatches.length > 0) {
      setServerHits([]);
      return;
    }
    debounceRef.current = setTimeout(() => runServerSearch(q), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, localMatches.length, runServerSearch]);

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: CustomerLookupRow[] = [];
    for (const r of localMatches) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
    for (const r of serverHits) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
    return out.slice(0, 8);
  }, [localMatches, serverHits]);

  function onPick(c: CustomerLookupRow) {
    setQ("");
    setEditing(false);
    start(async () => {
      const r = await setDiningOrderCustomerAction({ restaurantId, orderId, customerId: c.id });
      if (r.ok) router.refresh();
    });
  }

  function onClear() {
    if (!confirm("Retirer le lien avec cette fiche client ?")) return;
    start(async () => {
      const r = await setDiningOrderCustomerAction({ restaurantId, orderId, customerId: null });
      if (r.ok) router.refresh();
    });
  }

  if (!editing && linked) {
    return (
      <>
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2 text-sm">
          <p className="text-xs font-medium text-emerald-900">
            Client :{" "}
            <button
              type="button"
              className="font-semibold text-indigo-700 underline"
              onClick={() => setMemoOpen(true)}
            >
              {linked.display_name}
            </button>{" "}
            <Link href={`/clients/${linked.id}`} className="text-indigo-700 hover:underline">
              (fiche)
            </Link>{" "}
            — les plats de cette commande seront ajoutés à l’historique à l’encaissement.
            {linked.service_memo?.trim() ? (
              <span className="ml-1 text-emerald-800/90" title="Mémo renseigné sur la fiche">
                {" "}
                · mémo
              </span>
            ) : null}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={uiBtnOutlineSm} disabled={pending} onClick={() => setEditing(true)}>
              Changer
            </button>
            <button type="button" className={`${uiBtnOutlineSm} text-rose-700`} disabled={pending} onClick={onClear}>
              Retirer le lien
            </button>
          </div>
        </div>
        <CustomerTicketMemoDialog
          open={memoOpen}
          onClose={() => setMemoOpen(false)}
          customer={linked}
        />
      </>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="text-xs font-medium text-slate-700">Associer un client (base clients)</p>
      <p className="text-[11px] text-slate-500">Tapez le nom, l’e-mail ou le téléphone — même principe que le n° de lot en préparations.</p>
      <div className="relative mt-2 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            className={`${uiInput} w-full py-1.5 text-sm`}
            placeholder="Rechercher…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={pending}
          />
          {q.trim().length > 0 && suggestions.length > 0 ? (
            <div
              ref={listRef}
              className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-md"
            >
              {suggestions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="flex w-full flex-col items-start px-2 py-1.5 text-left text-sm hover:bg-indigo-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPick(c)}
                >
                  <span className="font-medium text-slate-900">{c.display_name}</span>
                  <span className="text-[11px] text-slate-500">{[c.email, c.phone].filter(Boolean).join(" · ")}</span>
                </button>
              ))}
              {searchLoading ? <div className="px-2 py-1 text-xs text-slate-500">Recherche…</div> : null}
            </div>
          ) : null}
        </div>
        {editing && linked ? (
          <button type="button" className={uiBtnOutlineSm} disabled={pending} onClick={() => setEditing(false)}>
            Annuler
          </button>
        ) : null}
      </div>
    </div>
  );
}
