"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { filterCustomersLocalPool, type CustomerLookupRow } from "@/lib/customers/customersDb";
import { searchCustomersLookupAction } from "@/app/clients/actions";
import { createCounterDiningOrder } from "./actions";
import { CAISSE_QUICK_COUNTER_STORAGE_KEY } from "./caisseQuickStorage";
import { uiBtnPrimary, uiError, uiInput } from "@/components/ui/premium";

type Props = { restaurantId: string; recentCustomerPool: CustomerLookupRow[] };

export function CaisseNewTicketForm({ restaurantId, recentCustomerPool }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [selectedClient, setSelectedClient] = useState<CustomerLookupRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [searchLoading, setSearchLoading] = useState(false);
  const [serverHits, setServerHits] = useState<CustomerLookupRow[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [listOpen, setListOpen] = useState(false);

  const nameNorm = name.trim().toLowerCase();
  const localMatches = useMemo(
    () => filterCustomersLocalPool(recentCustomerPool, name, 10),
    [recentCustomerPool, name]
  );

  const runServerSearch = useCallback(
    (q: string) => {
      if (q.trim().length < 2) {
        setServerHits([]);
        setSearchLoading(false);
        return;
      }
      setSearchLoading(true);
      void (async () => {
        const r = await searchCustomersLookupAction(restaurantId, q);
        setSearchLoading(false);
        if (r.ok) {
          setServerHits(r.rows);
        } else {
          setServerHits([]);
        }
      })();
    },
    [restaurantId]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (nameNorm.length < 2) {
      setServerHits([]);
      return;
    }
    if (localMatches.length > 0) {
      setServerHits([]);
      return;
    }
    debounceRef.current = setTimeout(() => runServerSearch(name), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, nameNorm, localMatches.length, runServerSearch]);

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
    return out.slice(0, 10);
  }, [localMatches, serverHits]);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const t = e.target as Node;
      if (listRef.current?.contains(t) || inputRef.current?.contains(t)) return;
      setListOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const goToOrder = (orderId: string) => {
    router.push(`/salle/commande/${orderId}?from=caisse`);
  };

  const selectClient = (c: CustomerLookupRow) => {
    setSelectedClient(c);
    setName(c.display_name);
    setListOpen(false);
  };

  const clearClient = () => {
    setSelectedClient(null);
  };

  const openNamed = () => {
    setError(null);
    const label = name.trim();
    if (!label) {
      setError("Indiquez un nom pour le ticket ou choisissez un client.");
      return;
    }
    startTransition(async () => {
      try {
        sessionStorage.removeItem(CAISSE_QUICK_COUNTER_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      const res = await createCounterDiningOrder({
        restaurantId,
        ticketLabel: label,
        customerId: selectedClient?.id ?? null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setName("");
      setSelectedClient(null);
      goToOrder(res.data!.orderId);
    });
  };

  return (
    <div className="space-y-2 border-b border-slate-200/80 pb-3">
      <p className="text-xs font-medium text-slate-500">
        Ticket à un nom — tapez pour retrouver un client (comme le n° de lot en préparations) ou saisissez un nom libre.
      </p>
      <div className="relative flex flex-wrap items-start gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            className={`${uiInput} w-full py-2 text-sm ${selectedClient ? "border-emerald-300 bg-emerald-50/50" : ""}`}
            placeholder="Nom affiché, e-mail, téléphone…"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (selectedClient && e.target.value.trim() !== selectedClient.display_name.trim()) {
                setSelectedClient(null);
              }
              setListOpen(true);
            }}
            onFocus={() => setListOpen(true)}
            disabled={pending}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                openNamed();
              }
              if (e.key === "Escape") setListOpen(false);
            }}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={listOpen && suggestions.length > 0}
          />
          {listOpen && (name.trim().length > 0 || suggestions.length > 0) && suggestions.length > 0 ? (
            <div
              ref={listRef}
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              role="listbox"
            >
              {suggestions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-indigo-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectClient(c)}
                >
                  <span className="font-medium text-slate-900">{c.display_name}</span>
                  <span className="text-xs text-slate-500">
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </span>
                </button>
              ))}
              {searchLoading ? (
                <div className="px-3 py-2 text-xs text-slate-500">Recherche…</div>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className={`${uiBtnPrimary} shrink-0 px-3 py-2 text-sm`}
          disabled={pending}
          onClick={openNamed}
        >
          Ouvrir
        </button>
      </div>
      {selectedClient ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-800">
          <span>
            Fiche liée : <strong>{selectedClient.display_name}</strong> — la commande alimentera l’historique et les
            habitudes.
          </span>
          <button
            type="button"
            className="font-semibold text-slate-600 underline"
            onClick={clearClient}
            disabled={pending}
          >
            Dissocier
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Sans sélection, le libellé reste un nom libre (aucune fiche liée).</p>
      )}
      {error ? <p className={`${uiError} w-full text-xs`}>{error}</p> : null}
    </div>
  );
}
